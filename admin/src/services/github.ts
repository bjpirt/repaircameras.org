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

export async function fetchTutorialJson(
  token: string,
  id: string,
): Promise<Tutorial> {
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

  return result.data;
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
