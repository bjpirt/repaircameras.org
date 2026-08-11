import { parseFrontmatter, stringifyFrontmatter } from "@shared/frontmatter";
import { CameraPageSchema, type CameraPage } from "@shared/types/cameraPage";
import { config } from "../config";
import {
  API_BASE,
  headers,
  repoUrl,
  decodeBase64Utf8,
  blobToBase64,
  type GitHubContentItem,
  type GitHubFileContent,
  ensureFork,
  syncFork,
  createGitBlob,
  createTree,
  createCommit,
  createRef,
  updateRef,
  getRefSha,
  getCommitTreeSha,
  listForkBranches,
  type TreeEntry,
  type SaveToForkBranchResult,
  type ForkBranch,
} from "./github";

const CAMERAS_PATH = "site/cameras";
const FILES_PATH = "site/files";
const LINKS_PATH = "site/_data/links";

export interface CameraFileEntry {
  manufacturer: string;
  manufacturerSlug: string;
  model: string;
  modelSlug: string;
}

export interface FetchCameraResult {
  cameraPage: CameraPage;
  sha: string;
}

export interface NewLinkEntry {
  id: string;
  title: string;
  url: string;
  description: string;
  thumbnailBlob: Blob;
}

export async function listCameraFiles(
  token: string,
): Promise<CameraFileEntry[]> {
  const res = await fetch(repoUrl(CAMERAS_PATH), {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to list cameras: ${res.status}`);
  }

  const items: GitHubContentItem[] = await res.json();
  const manufacturers = items.filter(
    (item) => item.type === "dir",
  );

  const cameras: CameraFileEntry[] = [];

  for (const mfg of manufacturers) {
    const mfgRes = await fetch(repoUrl(`${CAMERAS_PATH}/${mfg.name}`), {
      headers: headers(token),
    });

    if (!mfgRes.ok) continue;

    const mfgItems: GitHubContentItem[] = await mfgRes.json();
    for (const item of mfgItems) {
      if (item.type === "file" && item.name.endsWith(".md") && item.name !== "index.md") {
        const modelSlug = item.name.replace(/\.md$/, "");
        cameras.push({
          manufacturer: mfg.name,
          manufacturerSlug: mfg.name,
          model: modelSlug,
          modelSlug,
        });
      }
    }
  }

  return cameras;
}

async function fetchAndParseCameraPage(
  url: string,
  token: string,
): Promise<FetchCameraResult> {
  const res = await fetch(url, { headers: headers(token) });

  if (!res.ok) {
    throw new Error(`Failed to fetch camera page: ${res.status}`);
  }

  const file: GitHubFileContent = await res.json();
  const content = decodeBase64Utf8(file.content);
  const { attributes, body } = parseFrontmatter(content);

  const cameraData = {
    manufacturer: (attributes.manufacturer as string) ?? "",
    model: (attributes.model as string) ?? "",
    body,
    relatedFiles: (attributes.relatedFiles as string[]) ?? [],
    relatedLinks: (attributes.relatedLinks as string[]) ?? [],
    relatedArchives: (attributes.relatedArchives as string[]) ?? [],
    troubleshooting: (attributes.troubleshooting as unknown[]) ?? [],
  };

  const result = CameraPageSchema.safeParse(cameraData);
  if (!result.success) {
    throw new Error(`Invalid camera page data: ${result.error.message}`);
  }

  return { cameraPage: result.data, sha: file.sha };
}

export async function fetchCameraPage(
  token: string,
  manufacturerSlug: string,
  modelSlug: string,
): Promise<FetchCameraResult> {
  const url = repoUrl(`${CAMERAS_PATH}/${manufacturerSlug}/${modelSlug}.md`);
  return fetchAndParseCameraPage(url, token);
}

export async function fetchCameraPageFromRef(
  token: string,
  owner: string,
  branch: string,
  manufacturerSlug: string,
  modelSlug: string,
): Promise<FetchCameraResult> {
  const url = `${API_BASE}/repos/${owner}/${config.repoName}/contents/${CAMERAS_PATH}/${manufacturerSlug}/${modelSlug}.md?ref=${encodeURIComponent(branch)}`;
  return fetchAndParseCameraPage(url, token);
}

export async function listPdfFiles(token: string): Promise<string[]> {
  const res = await fetch(repoUrl(FILES_PATH), {
    headers: headers(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to list PDF files: ${res.status}`);
  }

  const items: GitHubContentItem[] = await res.json();
  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".pdf"))
    .map((item) => item.name.replace(/\.pdf$/, ""));
}

export async function listExistingLinks(token: string): Promise<string[]> {
  const res = await fetch(repoUrl(LINKS_PATH), {
    headers: headers(token),
  });

  if (res.status === 404) return [];

  if (!res.ok) {
    throw new Error(`Failed to list links: ${res.status}`);
  }

  const items: GitHubContentItem[] = await res.json();
  return items
    .filter((item) => item.type === "file" && item.name.endsWith(".json"))
    .map((item) => item.name.replace(/\.json$/, ""));
}

export async function listCameraBranches(
  token: string,
  username: string,
): Promise<ForkBranch[]> {
  return listForkBranches(token, username, "camera/");
}

export async function saveCameraToForkBranch(
  token: string,
  username: string,
  existingForkOwner: string | null,
  existingBranchName: string | null,
  newBranchName: string,
  manufacturerSlug: string,
  modelSlug: string,
  cameraPage: CameraPage,
  newLinks: NewLinkEntry[],
  existingManufacturers: string[],
  onProgress: (step: string) => void,
): Promise<SaveToForkBranchResult> {
  const isRepoOwner = username.toLowerCase() === config.repoOwner.toLowerCase();

  let forkOwner: string;
  if (existingForkOwner) {
    forkOwner = existingForkOwner;
  } else if (isRepoOwner) {
    forkOwner = config.repoOwner;
  } else {
    onProgress("Creating fork...");
    const fork = await ensureFork(token);
    forkOwner = fork.owner;
  }

  onProgress("Uploading files...");
  const treeEntries: TreeEntry[] = [];

  // Camera markdown file
  const { body, ...frontmatterFields } = cameraPage;
  const markdownContent = stringifyFrontmatter(
    {
      manufacturer: frontmatterFields.manufacturer,
      model: frontmatterFields.model,
      relatedFiles: frontmatterFields.relatedFiles,
      relatedLinks: frontmatterFields.relatedLinks,
      relatedArchives: frontmatterFields.relatedArchives,
      troubleshooting: frontmatterFields.troubleshooting,
    },
    body,
  );
  const mdBlobSha = await createGitBlob(token, forkOwner, markdownContent, "utf-8");
  treeEntries.push({
    path: `${CAMERAS_PATH}/${manufacturerSlug}/${modelSlug}.md`,
    mode: "100644",
    type: "blob",
    sha: mdBlobSha,
  });

  // Manufacturer index if new manufacturer
  if (!existingManufacturers.includes(manufacturerSlug)) {
    const indexContent = `---\ntags: manufacturers\nlayout: manufacturerIndex.11ty.tsx\nmanufacturer: ${cameraPage.manufacturer}\n---\n`;
    const indexBlobSha = await createGitBlob(token, forkOwner, indexContent, "utf-8");
    treeEntries.push({
      path: `${CAMERAS_PATH}/${manufacturerSlug}/index.md`,
      mode: "100644",
      type: "blob",
      sha: indexBlobSha,
    });
  }

  // New link files
  for (const link of newLinks) {
    const linkJson = JSON.stringify(
      { title: link.title, url: link.url, description: link.description },
      null,
      2,
    ) + "\n";
    const jsonBlobSha = await createGitBlob(token, forkOwner, linkJson, "utf-8");
    treeEntries.push({
      path: `${LINKS_PATH}/${link.id}.json`,
      mode: "100644",
      type: "blob",
      sha: jsonBlobSha,
    });

    const imgBase64 = await blobToBase64(link.thumbnailBlob);
    const imgBlobSha = await createGitBlob(token, forkOwner, imgBase64, "base64");
    treeEntries.push({
      path: `${LINKS_PATH}/${link.id}.jpg`,
      mode: "100644",
      type: "blob",
      sha: imgBlobSha,
    });
  }

  if (existingBranchName) {
    onProgress("Creating commit...");
    const branchTipSha = await getRefSha(token, forkOwner, existingBranchName);
    const branchTreeSha = await getCommitTreeSha(token, forkOwner, branchTipSha);
    const treeSha = await createTree(token, forkOwner, branchTreeSha, treeEntries);
    const commitMessage = `Update camera: ${cameraPage.manufacturer} ${cameraPage.model}`;
    const commitSha = await createCommit(token, forkOwner, commitMessage, treeSha, branchTipSha);
    await updateRef(token, forkOwner, existingBranchName, commitSha);
    return { forkOwner, branchName: existingBranchName };
  } else {
    if (!isRepoOwner) {
      onProgress("Syncing fork...");
      await syncFork(token, forkOwner);
    }
    onProgress("Creating commit...");
    const baseSha = await getRefSha(token, config.repoOwner, config.repoBranch);
    const baseTreeSha = await getCommitTreeSha(token, config.repoOwner, baseSha);
    const treeSha = await createTree(token, forkOwner, baseTreeSha, treeEntries);
    const commitMessage = `Add camera: ${cameraPage.manufacturer} ${cameraPage.model}`;
    const commitSha = await createCommit(token, forkOwner, commitMessage, treeSha, baseSha);
    await createRef(token, forkOwner, newBranchName, commitSha);
    return { forkOwner, branchName: newBranchName };
  }
}
