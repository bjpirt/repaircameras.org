import { TutorialSchema, type Tutorial } from "@shared/types/tutorial";
import { config } from "../config";

const API_BASE = "https://api.github.com";
const TUTORIALS_PATH = "site/tutorials";

interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
}

interface GitHubFileContent {
  content: string;
  encoding: "base64";
  sha: string;
}

export interface TutorialFileEntry {
  id: string;
  name: string;
  path: string;
  sha: string;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
}

function repoUrl(path: string): string {
  const base = `${API_BASE}/repos/${config.repoOwner}/${config.repoName}/contents/${path}`;
  return `${base}?ref=${encodeURIComponent(config.repoBranch)}`;
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

function contentUrl(path: string): string {
  return `${API_BASE}/repos/${config.repoOwner}/${config.repoName}/contents/${path}`;
}

interface GitHubPutResponse {
  content: { sha: string };
  commit: { sha: string };
}

export async function listTutorialFiles(
  token: string,
): Promise<TutorialFileEntry[]> {
  const res = await fetch(repoUrl(TUTORIALS_PATH), {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to list tutorials: ${res.status}`);
  }

  const items: GitHubContentItem[] = await res.json();

  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".json"))
    .map((item) => ({
      id: item.name.replace(/\.json$/, ""),
      name: item.name,
      path: item.path,
      sha: item.sha,
    }));
}

export interface FetchTutorialResult {
  tutorial: Tutorial;
  sha: string;
}

export async function fetchTutorialJson(
  token: string,
  id: string,
): Promise<FetchTutorialResult> {
  const res = await fetch(repoUrl(`${TUTORIALS_PATH}/${id}.json`), {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch tutorial ${id}: ${res.status}`);
  }

  const file: GitHubFileContent = await res.json();
  const json = JSON.parse(decodeBase64Utf8(file.content));
  const result = TutorialSchema.safeParse({ ...json, id });

  if (!result.success) {
    throw new Error(
      `Invalid tutorial data for ${id}: ${result.error.message}`,
    );
  }

  return { tutorial: result.data, sha: file.sha };
}

export interface TutorialImageEntry {
  name: string;
  path: string;
  sha: string;
  download_url: string;
}

export async function listTutorialImages(
  token: string,
  id: string,
): Promise<TutorialImageEntry[]> {
  const res = await fetch(repoUrl(`${TUTORIALS_PATH}/images/${id}`), {
    headers: headers(token),
  });

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Failed to list images for ${id}: ${res.status}`);
  }

  const items: (GitHubContentItem & { download_url: string })[] =
    await res.json();

  return items
    .filter((item) => item.type === "file")
    .map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      download_url: item.download_url,
    }));
}

export async function saveTutorial(
  token: string,
  id: string,
  tutorial: Tutorial,
  sha: string,
): Promise<string> {
  const { id: _id, ...data } = tutorial;
  const content = encodeBase64Utf8(JSON.stringify(data, null, 2) + "\n");

  const res = await fetch(contentUrl(`${TUTORIALS_PATH}/${id}.json`), {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Update tutorial: ${id}`,
      content,
      branch: config.repoBranch,
      sha,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to save tutorial ${id}: ${res.status}`);
  }

  const result: GitHubPutResponse = await res.json();
  return result.content.sha;
}

export async function createTutorial(
  token: string,
  id: string,
  tutorial: Tutorial,
): Promise<string> {
  const { id: _id, ...data } = tutorial;
  const content = encodeBase64Utf8(JSON.stringify(data, null, 2) + "\n");

  const res = await fetch(contentUrl(`${TUTORIALS_PATH}/${id}.json`), {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add tutorial: ${id}`,
      content,
      branch: config.repoBranch,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create tutorial ${id}: ${res.status}`);
  }

  const result: GitHubPutResponse = await res.json();
  return result.content.sha;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export async function uploadTutorialImage(
  token: string,
  tutorialId: string,
  filename: string,
  imageBlob: Blob,
): Promise<{ sha: string; download_url: string }> {
  const content = await blobToBase64(imageBlob);
  const path = `${TUTORIALS_PATH}/images/${tutorialId}/${filename}`;

  const res = await fetch(contentUrl(path), {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add image: ${tutorialId}/${filename}`,
      content,
      branch: config.repoBranch,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to upload image ${filename}: ${res.status}`);
  }

  const result: GitHubPutResponse = await res.json();
  const download_url = `https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/${config.repoBranch}/${path}`;

  return { sha: result.content.sha, download_url };
}

// --- Permission check ---

export async function checkPushAccess(
  token: string,
  username: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/repos/${config.repoOwner}/${config.repoName}/collaborators/${encodeURIComponent(username)}/permission`,
    { headers: headers(token) },
  );

  if (!res.ok) return false;

  const data: { permission: string } = await res.json();
  return data.permission === "admin" || data.permission === "write";
}

// --- Fork & PR workflow ---

function repoApiUrl(owner: string, repo: string, path: string): string {
  return `${API_BASE}/repos/${owner}/${repo}/${path}`;
}

export async function ensureFork(
  token: string,
): Promise<{ owner: string }> {
  const res = await fetch(
    `${API_BASE}/repos/${config.repoOwner}/${config.repoName}/forks`,
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ default_branch_only: true }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create fork: ${res.status}`);
  }

  const data: { owner: { login: string } } = await res.json();
  return { owner: data.owner.login };
}

export async function syncFork(
  token: string,
  forkOwner: string,
): Promise<void> {
  const res = await fetch(
    repoApiUrl(forkOwner, config.repoName, "merge-upstream"),
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ branch: config.repoBranch }),
    },
  );

  // 409 means already up to date — not an error
  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to sync fork: ${res.status}`);
  }
}

export async function getRefSha(
  token: string,
  owner: string,
  branch: string,
): Promise<string> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, `git/ref/heads/${encodeURIComponent(branch)}`),
    { headers: headers(token) },
  );

  if (!res.ok) {
    throw new Error(`Failed to get ref ${branch}: ${res.status}`);
  }

  const data: { object: { sha: string } } = await res.json();
  return data.object.sha;
}

export async function getCommitTreeSha(
  token: string,
  owner: string,
  commitSha: string,
): Promise<string> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, `git/commits/${commitSha}`),
    { headers: headers(token) },
  );

  if (!res.ok) {
    throw new Error(`Failed to get commit ${commitSha}: ${res.status}`);
  }

  const data: { tree: { sha: string } } = await res.json();
  return data.tree.sha;
}

export async function createGitBlob(
  token: string,
  owner: string,
  content: string,
  encoding: "utf-8" | "base64",
): Promise<string> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, "git/blobs"),
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ content, encoding }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create blob: ${res.status}`);
  }

  const data: { sha: string } = await res.json();
  return data.sha;
}

export interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  sha: string;
}

export async function createTree(
  token: string,
  owner: string,
  baseTreeSha: string,
  entries: TreeEntry[],
): Promise<string> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, "git/trees"),
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseTreeSha, tree: entries }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create tree: ${res.status}`);
  }

  const data: { sha: string } = await res.json();
  return data.sha;
}

export async function createCommit(
  token: string,
  owner: string,
  message: string,
  treeSha: string,
  parentSha: string,
): Promise<string> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, "git/commits"),
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create commit: ${res.status}`);
  }

  const data: { sha: string } = await res.json();
  return data.sha;
}

export async function createRef(
  token: string,
  owner: string,
  branch: string,
  sha: string,
): Promise<void> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, "git/refs"),
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create branch ${branch}: ${res.status}`);
  }
}

export async function updateRef(
  token: string,
  owner: string,
  branch: string,
  sha: string,
): Promise<void> {
  const res = await fetch(
    repoApiUrl(owner, config.repoName, `git/refs/heads/${encodeURIComponent(branch)}`),
    {
      method: "PATCH",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ sha, force: true }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to update branch ${branch}: ${res.status}`);
  }
}

export interface PullRequestResult {
  number: number;
  html_url: string;
}

export async function createPullRequest(
  token: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<PullRequestResult> {
  const res = await fetch(
    `${API_BASE}/repos/${config.repoOwner}/${config.repoName}/pulls`,
    {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, head, base }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to create pull request: ${res.status}`);
  }

  const data: { number: number; html_url: string } = await res.json();
  return { number: data.number, html_url: data.html_url };
}

export interface PendingImage {
  filename: string;
  blob: Blob;
}

export interface SaveToForkBranchResult {
  forkOwner: string;
  branchName: string;
}

export async function saveToForkBranch(
  token: string,
  existingForkOwner: string | null,
  existingBranchName: string | null,
  tutorialId: string,
  tutorial: Tutorial,
  pendingImages: PendingImage[],
  onProgress: (step: string) => void,
): Promise<SaveToForkBranchResult> {
  // Ensure fork exists
  let forkOwner: string;
  if (existingForkOwner) {
    forkOwner = existingForkOwner;
  } else {
    onProgress("Creating fork...");
    const fork = await ensureFork(token);
    forkOwner = fork.owner;
  }

  // Build blobs and tree entries
  onProgress("Uploading files...");
  const treeEntries: TreeEntry[] = [];

  // Tutorial JSON blob
  const { id: _id, ...data } = tutorial;
  const jsonContent = JSON.stringify(data, null, 2) + "\n";
  const jsonBlobSha = await createGitBlob(token, forkOwner, jsonContent, "utf-8");
  treeEntries.push({
    path: `${TUTORIALS_PATH}/${tutorialId}.json`,
    mode: "100644",
    type: "blob",
    sha: jsonBlobSha,
  });

  // Image blobs
  for (const img of pendingImages) {
    const base64Content = await blobToBase64(img.blob);
    const imgBlobSha = await createGitBlob(token, forkOwner, base64Content, "base64");
    treeEntries.push({
      path: `${TUTORIALS_PATH}/images/${tutorialId}/${img.filename}`,
      mode: "100644",
      type: "blob",
      sha: imgBlobSha,
    });
  }

  if (existingBranchName) {
    // Subsequent save: commit on top of existing branch
    onProgress("Creating commit...");
    const branchTipSha = await getRefSha(token, forkOwner, existingBranchName);
    const branchTreeSha = await getCommitTreeSha(token, forkOwner, branchTipSha);

    const treeSha = await createTree(token, forkOwner, branchTreeSha, treeEntries);
    const commitMessage = `Update tutorial: ${tutorialId}`;
    const commitSha = await createCommit(token, forkOwner, commitMessage, treeSha, branchTipSha);

    await updateRef(token, forkOwner, existingBranchName, commitSha);

    return { forkOwner, branchName: existingBranchName };
  } else {
    // First save: sync fork, create new branch
    onProgress("Syncing fork...");
    await syncFork(token, forkOwner);

    onProgress("Creating commit...");
    const baseSha = await getRefSha(token, config.repoOwner, config.repoBranch);
    const baseTreeSha = await getCommitTreeSha(token, config.repoOwner, baseSha);

    const treeSha = await createTree(token, forkOwner, baseTreeSha, treeEntries);
    const commitMessage = pendingImages.length > 0
      ? `Add tutorial: ${tutorialId}\n\nIncludes ${pendingImages.length} image${pendingImages.length !== 1 ? "s" : ""}.`
      : `Add tutorial: ${tutorialId}`;
    const commitSha = await createCommit(token, forkOwner, commitMessage, treeSha, baseSha);

    const branchName = `tutorial/${tutorialId}-${Date.now()}`;
    await createRef(token, forkOwner, branchName, commitSha);

    return { forkOwner, branchName };
  }
}

export async function submitTutorialAsPR(
  token: string,
  username: string,
  tutorialId: string,
  tutorial: Tutorial,
  pendingImages: PendingImage[],
  onProgress: (step: string) => void,
): Promise<PullRequestResult> {
  const { forkOwner, branchName } = await saveToForkBranch(
    token,
    null,
    null,
    tutorialId,
    tutorial,
    pendingImages,
    onProgress,
  );

  onProgress("Opening pull request...");
  const pr = await createPullRequest(
    token,
    `Add tutorial: ${tutorial.title}`,
    `Adds a new tutorial for the ${tutorial.manufacturer} ${tutorial.model}.\n\nSubmitted via the admin editor by @${username}.`,
    `${forkOwner}:${branchName}`,
    config.repoBranch,
  );

  return pr;
}
