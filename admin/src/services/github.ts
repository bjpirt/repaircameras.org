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
