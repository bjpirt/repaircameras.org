#!/usr/bin/env node

// Permanently remove PDF blobs from git history.
//
// Anything not in the current commit is removable weight, but it splits into
// two very different cases:
//
//   --superseded  An older version of a PDF that is still at the tip under the
//                 same name. A newer copy of the document survives, so these
//                 are safe to drop without any further checks.
//
//   --deleted     A PDF with no copy left at the tip — usually one migrated to
//                 the Internet Archive. Purging destroys the last copy in this
//                 repo, so each one must be verified live on archive.org via
//                 its descriptor in site/_data/ia. Unverifiable files are
//                 skipped unless you pass --allow-unverified.
//
// Targets are resolved to blob SHAs rather than paths, so a file is caught
// wherever it lived across history (site/files/... on main, files/... on
// gh-pages, or wherever it sat before the manufacturer reorganisation).
//
// Nothing is rewritten without --execute, and nothing is ever pushed.

import fs from "fs";
import Path from "path";
import { execSync } from "child_process";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

const IA_DIR = "site/_data/ia";
const CONFIRMATION = "rewrite history";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const values = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return [];
  const out = [];
  for (let i = at + 1; i < args.length && !args[i].startsWith("--"); i++) {
    out.push(args[i]);
  }
  return out;
};

const options = {
  superseded: flag("superseded") || flag("all"),
  deleted: flag("deleted") || flag("all"),
  paths: values("paths"),
  allowUnverified: flag("allow-unverified"),
  execute: flag("execute"),
  backup: !flag("no-backup"),
};

if (!options.superseded && !options.deleted && options.paths.length === 0) {
  console.error(`Usage: node bin/purge-pdf-history.js [targets] [--execute]

Targets (at least one required):
  --superseded          Older versions of PDFs still present at the tip
  --deleted             PDFs with no copy at the tip, verified live on
                        archive.org via their ${IA_DIR} descriptor
  --all                 Both of the above
  --paths <path>...     Specific historical paths, verified the same way

Options:
  --allow-unverified    Purge deleted PDFs that have no Internet Archive
                        copy. This destroys the last copy — be certain.
  --execute             Actually rewrite. Without it, this is a dry run.
  --no-backup           Skip the mirror backup (not recommended)`);
  process.exit(1);
}

// Returns "" for commands run with inherited stdio, which produce no capture
const sh = (cmd, opts = {}) =>
  (
    execSync(cmd, { encoding: "utf8", maxBuffer: 1024 * 1024 * 512, ...opts }) ?? ""
  ).trim();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const formatSize = (bytes) =>
  bytes > 1073741824
    ? `${(bytes / 1073741824).toFixed(2)} GiB`
    : `${Math.round(bytes / 1048576)} MiB`;

// --- preflight -------------------------------------------------------------

function preflight() {
  const problems = [];

  try {
    sh("git filter-repo --version", { stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    problems.push(
      "git-filter-repo is not installed. Install it with:\n" +
        "    brew install git-filter-repo\n" +
        "  (or: pipx install git-filter-repo)",
    );
  }

  if (sh("git status --porcelain")) {
    problems.push(
      "Working tree is not clean. Commit or stash everything first — a rewrite\n" +
        "  discards anything git isn't tracking as committed.",
    );
  }

  // gh-pages holds the same PDF blobs as main. Left in place, its refs keep
  // those blobs reachable and the rewrite reclaims nothing.
  const ghPages = sh(
    "git for-each-ref --format='%(refname)' | grep -i gh-pages || true",
  );
  if (ghPages) {
    problems.push(
      `These gh-pages refs still reference the same PDF blobs:\n${ghPages
        .split("\n")
        .map((r) => `    ${r}`)
        .join("\n")}\n` +
        "  gh-pages is regenerated on every deploy, so delete it first:\n" +
        "    git push origin --delete gh-pages\n" +
        "    git branch -D gh-pages 2>/dev/null; git update-ref -d refs/remotes/origin/gh-pages",
    );
  }

  return problems;
}

// --- reading history -------------------------------------------------------

// Every PDF blob anywhere in history, with the paths it was ever stored at
function pdfBlobsInHistory() {
  const revList = sh("git rev-list --objects --all");
  const check = sh(
    "git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)'",
    { input: revList },
  );

  const blobs = new Map();
  for (const line of check.split("\n")) {
    const [type, sha, size, ...rest] = line.split(" ");
    const path = rest.join(" ");
    if (type !== "blob" || !path.endsWith(".pdf")) continue;
    if (!blobs.has(sha)) {
      blobs.set(sha, { size: Number(size), paths: new Set() });
    }
    blobs.get(sha).paths.add(path);
  }
  return blobs;
}

// PDF blobs and filenames in the current commit — these must survive
function currentTip() {
  const tree = sh("git ls-tree -r HEAD --format='%(objectname) %(path)'");
  const shas = new Map();
  const basenames = new Set();
  for (const line of tree.split("\n")) {
    const [sha, ...rest] = line.split(" ");
    const path = rest.join(" ");
    if (!path.endsWith(".pdf")) continue;
    shas.set(sha, path);
    basenames.add(Path.basename(path));
  }
  return { shas, basenames };
}

// A blob is superseded if any path it ever had shares a filename with a PDF
// still at the tip; otherwise the document is gone from the repo entirely.
function classify(history, tip) {
  const superseded = [];
  const deleted = new Map(); // basename -> blobs

  for (const [sha, meta] of history) {
    if (tip.shas.has(sha)) continue;

    const names = [...meta.paths].map((p) => Path.basename(p));
    if (names.some((n) => tip.basenames.has(n))) {
      superseded.push({ sha, ...meta });
      continue;
    }
    const name = names[0];
    if (!deleted.has(name)) deleted.set(name, []);
    deleted.get(name).push({ sha, ...meta });
  }

  return { superseded, deleted };
}

// --- Internet Archive verification -----------------------------------------

function loadDescriptors() {
  if (!fs.existsSync(IA_DIR)) return new Map();
  return new Map(
    fs
      .readdirSync(IA_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => [
        Path.parse(f).name,
        JSON.parse(fs.readFileSync(`${IA_DIR}/${f}`, "utf8")),
      ]),
  );
}

// The bytes are about to become unrecoverable from this repo, so confirm the
// Internet Archive really is still serving them
async function isLiveOnArchive(descriptor) {
  const url = `https://archive.org/download/${descriptor.identifier}/${descriptor.file}`;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  }
}

async function verifyDeleted(deleted, descriptors) {
  const purge = [];
  const skipped = [];

  for (const [name, blobs] of deleted) {
    const id = name.replace(/\.pdf$/i, "");
    const descriptor = descriptors.get(id);
    const bytes = blobs.reduce((s, b) => s + b.size, 0);

    if (!descriptor) {
      if (options.allowUnverified) {
        console.log(`  ${name}: no archive copy — purging anyway (--allow-unverified)`);
        purge.push(...blobs);
      } else {
        skipped.push({ name, bytes, reason: `no ${IA_DIR}/${id}.json descriptor` });
      }
      continue;
    }

    if (await isLiveOnArchive(descriptor)) {
      console.log(`  ${name}: verified live on archive.org`);
      purge.push(...blobs);
    } else {
      skipped.push({ name, bytes, reason: "not retrievable from archive.org" });
    }
  }

  return { purge, skipped };
}

// --- main ------------------------------------------------------------------

// A dry run only reads, so preflight failures are warnings until --execute
const problems = preflight();
if (problems.length > 0) {
  console.error(
    options.execute ? "Cannot continue:\n" : "Blockers for --execute:\n",
  );
  for (const problem of problems) console.error(`  • ${problem}\n`);
  if (options.execute) process.exit(1);
}

console.log("Reading history...");
const history = pdfBlobsInHistory();
const tip = currentTip();
const { superseded, deleted } = classify(history, tip);

const historyBytes = [...history.values()].reduce((s, b) => s + b.size, 0);
const tipBytes = [...tip.shas.keys()].reduce((s, sha) => s + history.get(sha).size, 0);

console.log(
  `\n${history.size} PDF blobs in history (${formatSize(historyBytes)}), ` +
    `${tip.shas.size} at the current tip (${formatSize(tipBytes)})\n`,
);

const targets = new Map();
const add = (blobs) => blobs.forEach((b) => targets.set(b.sha, b));
const skipped = [];

if (options.superseded) {
  const bytes = superseded.reduce((s, b) => s + b.size, 0);
  console.log(
    `Superseded versions: ${plural(superseded.length, "blob")} ` +
      `(${formatSize(bytes)}) — a newer copy survives at the tip`,
  );
  add(superseded);
}

if (options.deleted) {
  console.log(`\nDeleted files: ${plural(deleted.size, "document")} with no copy at the tip`);
  const result = await verifyDeleted(deleted, loadDescriptors());
  add(result.purge);
  skipped.push(...result.skipped);
}

if (options.paths.length > 0) {
  console.log("\nExplicit paths:");
  const byPath = new Map();
  for (const [name, blobs] of deleted) {
    for (const blob of blobs) {
      for (const path of blob.paths) byPath.set(path, { name, blob });
    }
  }
  const requested = new Map();
  for (const path of options.paths) {
    const match = byPath.get(path);
    if (!match) {
      console.log(`  ${path}: not in history, or still present at the tip`);
      continue;
    }
    if (!requested.has(match.name)) requested.set(match.name, []);
    requested.get(match.name).push(match.blob);
  }
  const result = await verifyDeleted(requested, loadDescriptors());
  add(result.purge);
  skipped.push(...result.skipped);
}

if (skipped.length > 0) {
  const bytes = skipped.reduce((s, x) => s + x.bytes, 0);
  console.log(
    `\nSKIPPED — last copy in this repo (${formatSize(bytes)}). Purging these ` +
      `loses them for good:`,
  );
  for (const { name, bytes, reason } of skipped.sort((a, b) => b.bytes - a.bytes)) {
    console.log(`  ${formatSize(bytes).padStart(9)}  ${name} — ${reason}`);
  }
  console.log("  Upload them to the Internet Archive first, or pass --allow-unverified.");
}

if (targets.size === 0) {
  console.log("\nNothing to purge.");
  process.exit(0);
}

const reclaimed = [...targets.values()].reduce((s, t) => s + t.size, 0);
console.log(
  `\n${plural(targets.size, "blob")} to purge, reclaiming ${formatSize(reclaimed)}:`,
);
for (const target of [...targets.values()].sort((a, b) => b.size - a.size).slice(0, 20)) {
  console.log(`  ${formatSize(target.size).padStart(9)}  ${[...target.paths][0]}`);
}
if (targets.size > 20) console.log(`  ... and ${targets.size - 20} more`);

if (!options.execute) {
  console.log("\nDry run. Re-run with --execute to rewrite history.");
  process.exit(0);
}

// --- execute ---------------------------------------------------------------

console.log(`
This rewrites every commit that touched these files. Consequences:

  • Every commit SHA from the earliest affected commit onwards changes
  • You must force-push all branches; anyone else must re-clone
  • Open PRs (including any from the admin UI's fork workflow) become
    unmergeable and need reopening against the new history
  • Any existing fork keeps the old objects, and GitHub can still serve
    them through the fork network until those forks are gone
  • A commit that only deleted PDFs becomes empty and is pruned
`);

const rl = readline.createInterface({ input: stdin, output: stdout });
const answer = await new Promise((resolve) =>
  rl.question(`Type "${CONFIRMATION}" to continue: `, resolve),
);
rl.close();

if (answer.trim() !== CONFIRMATION) {
  console.log("Aborted.");
  process.exit(1);
}

if (options.backup) {
  const backup = Path.resolve(`../repaircameras-backup-${Date.now()}.git`);
  console.log(`\nMirroring to ${backup} (hardlinked, so this is cheap)...`);
  sh(`git clone --mirror . "${backup}"`, { stdio: "inherit" });
}

const blobList = ".git/pdf-blobs-to-purge.txt";
fs.writeFileSync(blobList, [...targets.keys()].join("\n") + "\n");

console.log("\nRewriting...");
sh(`git filter-repo --force --strip-blobs-with-ids ${blobList}`, {
  stdio: "inherit",
});
fs.unlinkSync(blobList);

console.log(`
Done. filter-repo has already expired reflogs, dropped unreferenced objects
and removed the 'origin' remote (it does this to stop an accidental push).

Verify, then publish:

  du -sh .git
  node bin/purge-pdf-history.js --all           # should report nothing new
  npm run build                                 # site still builds

  git remote add origin git@github.com:bjpirt/repaircameras.org.git
  git push --force --all origin

Then, on GitHub: reopen any in-flight PRs, and expect the repo to keep
reporting its old size until GitHub runs its own gc — ask Support to
trigger one if it matters.
`);
