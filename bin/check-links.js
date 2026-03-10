#!/usr/bin/env node

import fs from "fs";
import path from "path";

const CAMERAS_DIR = "site/cameras";
const FILES_DIR = "site/files";

// Collect all PDFs in site/files/{manufacturer}/
const allPdfs = new Set(
  fs.readdirSync(FILES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      fs.readdirSync(path.join(FILES_DIR, d.name))
        .filter((f) => f.endsWith(".pdf"))
        .map((f) => `${d.name}/${f.replace(".pdf", "")}`)
    )
);

// Collect all relatedFiles references from camera pages
function getCameraFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getCameraFiles(fullPath));
    } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
      const content = fs.readFileSync(fullPath, "utf8");
      const relatedFilesMatch = content.match(/relatedFiles:\s*\n((?:\s+-\s+.+\n)*)/);
      if (relatedFilesMatch && relatedFilesMatch[1]) {
        const refs = relatedFilesMatch[1]
          .split("\n")
          .filter((line) => line.trim().startsWith("-"))
          .map((line) => line.replace(/^\s*-\s*/, "").trim());
        for (const ref of refs) {
          results.push({ ref, file: fullPath });
        }
      }
    }
  }
  return results;
}

const cameraRefs = getCameraFiles(CAMERAS_DIR);
const referencedFiles = new Set(cameraRefs.map((r) => r.ref));

let errors = 0;

// Check for broken references (camera page points to non-existent PDF)
for (const { ref, file } of cameraRefs) {
  if (!allPdfs.has(ref)) {
    console.error(`Broken reference: ${file} -> ${ref}.pdf (file not found)`);
    errors++;
  }
}

// Check for orphaned PDFs (not referenced by any camera page)
for (const pdf of allPdfs) {
  if (!referencedFiles.has(pdf)) {
    console.error(`Orphaned file: ${FILES_DIR}/${pdf}.pdf (not referenced by any camera page)`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} issue(s) found.`);
  process.exit(1);
} else {
  console.log("All file links OK.");
}
