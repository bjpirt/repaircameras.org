import type { Page } from "@playwright/test";

// Tutorial data as stored in the repo (without id field)
const tutorialData = {
  title: "Olympus OM-1 Basic CLA",
  manufacturer: "Olympus",
  model: "OM-1",
  description: "A basic CLA of the Olympus OM-1.",
  tools: ["JIS screwdrivers"],
  steps: [{ title: "Step 1", substeps: [{ text: "Clean the lens." }], photos: [] }],
};

function encodeContent(data: unknown): string {
  return Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64");
}

// GitHub API response shapes used across tests
export const tutorialFileContent = {
  name: "olympus-om1-cla.json",
  path: "site/tutorials/olympus-om1-cla.json",
  sha: "file-sha-abc",
  content: encodeContent(tutorialData),
  encoding: "base64",
};

export const tutorialDirListing = [
  {
    name: "olympus-om1-cla.json",
    path: "site/tutorials/olympus-om1-cla.json",
    sha: "file-sha-abc",
    type: "file",
  },
];

// Route helper: register a URL-predicate route that fulfills with JSON.
// Using function predicates avoids issues with percent-encoding in regex patterns
// (Playwright decodes the URL before regex matching but the URL object's pathname
// preserves percent-encoded characters for path separators).
function fulfill(page: Page, predicate: (url: URL) => boolean, body: unknown, status: number) {
  return page.route(
    (url) => predicate(url),
    (route) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

// Decode pathname so %2F in branch names becomes / for easy matching
function path(url: URL): string {
  return decodeURIComponent(url.pathname);
}

const GH = "api.github.com";

// --- Tutorial list helpers ---

/** Mock the published tutorial directory + individual file + fork branches. */
export async function setupTutorialListMocks(
  page: Page,
  branchList: unknown[] = [],
) {
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/bjpirt/repaircameras.org/contents/site/tutorials",
    tutorialDirListing, 200,
  );
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/bjpirt/repaircameras.org/contents/site/tutorials/olympus-om1-cla.json",
    tutorialFileContent, 200,
  );
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname.startsWith("/repos/test-user/repaircameras.org/branches"),
    branchList, 200,
  );
}

/** Mock an empty repository (no published tutorials). */
export async function setupEmptyRepoMocks(page: Page, branchList: unknown[] = []) {
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/bjpirt/repaircameras.org/contents/site/tutorials",
    [], 200,
  );
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname.startsWith("/repos/test-user/repaircameras.org/branches"),
    branchList, 200,
  );
}

// --- Tutorial editor helpers ---

/**
 * Make both fork-branch ref checks return 404 so the editor falls back to
 * loading from the main repo.
 *
 * getRefSha uses encodeURIComponent on the branch name, so the URL contains
 * %2F. We decode the pathname before matching to handle either form.
 */
export async function setupNoBranchMocks(page: Page) {
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      path(url).startsWith("/repos/test-user/repaircameras.org/git/ref/heads/"),
    { message: "Not Found" },
    404,
  );
}

/** Mock loading the tutorial JSON + images from the main repo. */
export async function setupLoadFromMainMocks(page: Page) {
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      url.pathname === "/repos/bjpirt/repaircameras.org/contents/site/tutorials/olympus-om1-cla.json",
    tutorialFileContent, 200,
  );
  // Images directory returns 404 (no images)
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      url.pathname.startsWith("/repos/bjpirt/repaircameras.org/contents/site/tutorials/images/olympus-om1-cla"),
    { message: "Not Found" }, 404,
  );
}

/** Mock loading the tutorial from an existing fork edit branch. */
export async function setupAutoResumeMocks(page: Page) {
  // Edit branch ref exists — decode pathname to match %2F-encoded branch name
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      path(url) === "/repos/test-user/repaircameras.org/git/ref/heads/tutorial/edit/olympus-om1-cla",
    { object: { sha: "branch-tip-sha" } }, 200,
  );
  // Tutorial JSON from fork branch (identified by owner, not branch in pathname)
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      url.pathname === "/repos/test-user/repaircameras.org/contents/site/tutorials/olympus-om1-cla.json",
    tutorialFileContent, 200,
  );
  // Images from fork branch (none)
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      url.pathname.startsWith("/repos/test-user/repaircameras.org/contents/site/tutorials/images/olympus-om1-cla"),
    { message: "Not Found" }, 404,
  );
}

/**
 * Mock the full saveToForkBranch flow for a first-time save (new branch).
 * Covers: ensureFork → syncFork → getRefSha(base) → getCommitTreeSha →
 *         createGitBlob → createTree → createCommit → createRef
 */
export async function setupSaveToNewBranchMocks(page: Page) {
  // ensureFork: POST /repos/bjpirt/repaircameras.org/forks
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/bjpirt/repaircameras.org/forks",
    { owner: { login: "test-user" } }, 201,
  );

  // syncFork: POST /repos/test-user/repaircameras.org/merge-upstream
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/merge-upstream",
    { message: "up to date" }, 200,
  );

  // getRefSha(base branch): broad match since repoBranch may vary by environment
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      url.pathname.startsWith("/repos/bjpirt/repaircameras.org/git/ref/heads/"),
    { object: { sha: "base-sha" } }, 200,
  );

  // getCommitTreeSha: GET .../git/commits/base-sha
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/bjpirt/repaircameras.org/git/commits/base-sha",
    { tree: { sha: "base-tree-sha" } }, 200,
  );

  // createGitBlob: POST .../git/blobs
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/blobs",
    { sha: "blob-sha" }, 201,
  );

  // createTree: POST .../git/trees
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/trees",
    { sha: "tree-sha" }, 201,
  );

  // createCommit: POST .../git/commits
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/commits",
    { sha: "commit-sha" }, 201,
  );

  // createRef (new branch): POST .../git/refs
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/refs",
    { ref: "refs/heads/tutorial/new/my-tutorial" }, 201,
  );
}

/**
 * Mock the full saveToForkBranch flow for a subsequent save (existing branch).
 * Covers: getRefSha(branch) → getCommitTreeSha → createGitBlob → createTree →
 *         createCommit → updateRef
 */
export async function setupSaveToExistingBranchMocks(page: Page) {
  // getRefSha(branch): branch name is URL-encoded, decode pathname for matching
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      path(url) === "/repos/test-user/repaircameras.org/git/ref/heads/tutorial/edit/olympus-om1-cla",
    { object: { sha: "branch-tip-sha" } }, 200,
  );

  // getCommitTreeSha: GET .../git/commits/branch-tip-sha
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      url.pathname === "/repos/test-user/repaircameras.org/git/commits/branch-tip-sha",
    { tree: { sha: "branch-tree-sha" } }, 200,
  );

  // createGitBlob
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/blobs",
    { sha: "blob-sha" }, 201,
  );

  // createTree
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/trees",
    { sha: "tree-sha" }, 201,
  );

  // createCommit
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/test-user/repaircameras.org/git/commits",
    { sha: "new-commit-sha" }, 201,
  );

  // updateRef: PATCH .../git/refs/heads/tutorial/edit/olympus-om1-cla (URL-encoded)
  await fulfill(
    page,
    (url) =>
      url.hostname === GH &&
      path(url) === "/repos/test-user/repaircameras.org/git/refs/heads/tutorial/edit/olympus-om1-cla",
    { ref: "refs/heads/tutorial/edit/olympus-om1-cla" }, 200,
  );
}

/** Mock creating a pull request. */
export async function setupSubmitPRMocks(page: Page) {
  await fulfill(
    page,
    (url) => url.hostname === GH && url.pathname === "/repos/bjpirt/repaircameras.org/pulls",
    { number: 42, html_url: "https://github.com/bjpirt/repaircameras.org/pull/42" },
    201,
  );
}
