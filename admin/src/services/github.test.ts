import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTutorialFiles,
  fetchTutorialJson,
  fetchTutorialJsonFromRef,
  listTutorialImages,
  saveTutorial,
  createTutorial,
  uploadTutorialImage,
  checkPushAccess,
  ensureFork,
  listForkBranches,
  syncFork,
  getRefSha,
  getCommitTreeSha,
  createGitBlob,
  createTree,
  createCommit,
  createRef,
  updateRef,
  createPullRequest,
  saveToForkBranch,
} from "./github";
import { calculateResizeDimensions } from "./imageResize";

vi.mock("../config", () => ({
  config: {
    githubClientId: "test-client-id",
    tokenEndpoint: "http://localhost:8788/token",
    redirectUri: "http://localhost:5173/admin/",
    repoOwner: "test-owner",
    repoName: "test-repo",
    repoBranch: "main",
  },
}));

const TOKEN = "ghp_test-token";

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

function base64Encode(str: string): string {
  return btoa(
    new TextEncoder()
      .encode(str)
      .reduce((s, b) => s + String.fromCharCode(b), ""),
  );
}

function base64Decode(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const sampleTutorialJson = {
  title: "Olympus OM-1 Basic CLA",
  manufacturer: "Olympus",
  model: "OM-1",
  description: "A basic CLA of the Olympus OM-1.",
  tools: ["JIS screwdrivers"],
  steps: [
    {
      title: "Remove the bottom plate",
      intro: "The bottom plate is held by three screws.",
      substeps: [{ text: "Remove the screws." }],
      photos: [],
    },
  ],
};

const sampleTutorial = { id: "olympus-om1-cla", ...sampleTutorialJson };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("listTutorialFiles", () => {
  it("returns filtered JSON file entries", async () => {
    const items = [
      { name: "olympus-om1-cla.json", path: "site/tutorials/olympus-om1-cla.json", sha: "abc123", type: "file" },
      { name: "images", path: "site/tutorials/images", sha: "def456", type: "dir" },
      { name: "README.md", path: "site/tutorials/README.md", sha: "ghi789", type: "file" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(items)));

    const result = await listTutorialFiles(TOKEN);

    expect(result).toEqual([
      { id: "olympus-om1-cla", name: "olympus-om1-cla.json", path: "site/tutorials/olympus-om1-cla.json", sha: "abc123" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/contents/site/tutorials?ref=main",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 404)));

    await expect(listTutorialFiles(TOKEN)).rejects.toThrow("Failed to list tutorials: 404");
  });
});

describe("fetchTutorialJson", () => {
  it("decodes base64 content, parses with Zod, and returns sha", async () => {
    const encoded = base64Encode(JSON.stringify(sampleTutorialJson));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: encoded, encoding: "base64", sha: "file-sha-123" }),
      ),
    );

    const { tutorial, sha } = await fetchTutorialJson(TOKEN, "olympus-om1-cla");

    expect(tutorial.id).toBe("olympus-om1-cla");
    expect(tutorial.title).toBe("Olympus OM-1 Basic CLA");
    expect(tutorial.manufacturer).toBe("Olympus");
    expect(tutorial.steps).toHaveLength(1);
    expect(sha).toBe("file-sha-123");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/contents/site/tutorials/olympus-om1-cla.json?ref=main",
      expect.anything(),
    );
  });

  it("handles UTF-8 characters in base64 content", async () => {
    const jsonWithUtf8 = { ...sampleTutorialJson, title: "Réparation caméra" };
    const encoded = base64Encode(JSON.stringify(jsonWithUtf8));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: encoded, encoding: "base64", sha: "abc" }),
      ),
    );

    const { tutorial } = await fetchTutorialJson(TOKEN, "test-tutorial");

    expect(tutorial.title).toBe("Réparation caméra");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 404)));

    await expect(fetchTutorialJson(TOKEN, "missing")).rejects.toThrow(
      "Failed to fetch tutorial missing: 404",
    );
  });

  it("throws on invalid tutorial JSON", async () => {
    const invalid = { title: "No other fields" };
    const encoded = base64Encode(JSON.stringify(invalid));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: encoded, encoding: "base64", sha: "abc" }),
      ),
    );

    await expect(fetchTutorialJson(TOKEN, "bad-data")).rejects.toThrow(
      "Invalid tutorial data for bad-data",
    );
  });

  it("throws on malformed JSON content", async () => {
    const encoded = base64Encode("not valid json {{{");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: encoded, encoding: "base64", sha: "abc" }),
      ),
    );

    await expect(fetchTutorialJson(TOKEN, "broken")).rejects.toThrow();
  });
});

describe("fetchTutorialJsonFromRef", () => {
  it("fetches tutorial from a specific owner and branch", async () => {
    const encoded = base64Encode(JSON.stringify(sampleTutorialJson));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: encoded, encoding: "base64", sha: "fork-sha" }),
      ),
    );

    const { tutorial, sha } = await fetchTutorialJsonFromRef(TOKEN, "contributor", "tutorial/edit/olympus-om1-cla", "olympus-om1-cla");

    expect(tutorial.id).toBe("olympus-om1-cla");
    expect(tutorial.title).toBe("Olympus OM-1 Basic CLA");
    expect(sha).toBe("fork-sha");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/contributor/test-repo/contents/site/tutorials/olympus-om1-cla.json?ref=tutorial%2Fedit%2Folympus-om1-cla",
      expect.anything(),
    );
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 404)));

    await expect(
      fetchTutorialJsonFromRef(TOKEN, "contributor", "tutorial/edit/missing", "missing"),
    ).rejects.toThrow("Failed to fetch tutorial missing from contributor/tutorial/edit/missing: 404");
  });
});

describe("listTutorialImages", () => {
  it("returns image file entries", async () => {
    const items = [
      { name: "step1.jpeg", path: "site/tutorials/images/om1/step1.jpeg", sha: "aaa", type: "file", download_url: "https://raw.githubusercontent.com/test-owner/test-repo/main/site/tutorials/images/om1/step1.jpeg" },
      { name: "step2.webp", path: "site/tutorials/images/om1/step2.webp", sha: "bbb", type: "file", download_url: "https://raw.githubusercontent.com/test-owner/test-repo/main/site/tutorials/images/om1/step2.webp" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(items)));

    const result = await listTutorialImages(TOKEN, "om1");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("step1.jpeg");
    expect(result[0].download_url).toContain("step1.jpeg");
  });

  it("returns empty array on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 404)));

    const result = await listTutorialImages(TOKEN, "no-images");

    expect(result).toEqual([]);
  });

  it("throws on other non-OK responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 500)));

    await expect(listTutorialImages(TOKEN, "broken")).rejects.toThrow(
      "Failed to list images for broken: 500",
    );
  });
});

describe("saveTutorial", () => {
  it("sends PUT with sha, branch, and base64-encoded content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: { sha: "new-sha-456" }, commit: { sha: "commit-sha" } }),
      ),
    );

    const newSha = await saveTutorial(TOKEN, "olympus-om1-cla", sampleTutorial, "old-sha-123");

    expect(newSha).toBe("new-sha-456");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/contents/site/tutorials/olympus-om1-cla.json",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.sha).toBe("old-sha-123");
    expect(body.branch).toBe("main");
    expect(body.message).toBe("Update tutorial: olympus-om1-cla");

    const decoded = JSON.parse(base64Decode(body.content));
    expect(decoded.id).toBeUndefined();
    expect(decoded.title).toBe("Olympus OM-1 Basic CLA");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 409)));

    await expect(
      saveTutorial(TOKEN, "test", sampleTutorial, "old-sha"),
    ).rejects.toThrow("Failed to save tutorial test: 409");
  });
});

describe("createTutorial", () => {
  it("sends PUT without sha in body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: { sha: "created-sha" }, commit: { sha: "commit-sha" } }),
      ),
    );

    const newSha = await createTutorial(TOKEN, "new-tutorial", sampleTutorial);

    expect(newSha).toBe("created-sha");

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.sha).toBeUndefined();
    expect(body.branch).toBe("main");
    expect(body.message).toBe("Add tutorial: new-tutorial");
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 422)));

    await expect(
      createTutorial(TOKEN, "test", sampleTutorial),
    ).rejects.toThrow("Failed to create tutorial test: 422");
  });
});

describe("uploadTutorialImage", () => {
  it("sends PUT with base64-encoded blob and returns sha + download_url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: { sha: "img-sha-123" }, commit: { sha: "commit-sha" } }),
      ),
    );

    const blob = new Blob(["fake-image-data"], { type: "image/jpeg" });
    const result = await uploadTutorialImage(TOKEN, "olympus-om1-cla", "step1.jpg", blob);

    expect(result.sha).toBe("img-sha-123");
    expect(result.download_url).toBe(
      "https://raw.githubusercontent.com/test-owner/test-repo/main/site/tutorials/images/olympus-om1-cla/step1.jpg",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/contents/site/tutorials/images/olympus-om1-cla/step1.jpg",
      expect.objectContaining({ method: "PUT" }),
    );

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.message).toBe("Add image: olympus-om1-cla/step1.jpg");
    expect(body.branch).toBe("main");
    expect(body.content).toBeTruthy();
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 422)));

    const blob = new Blob(["data"], { type: "image/jpeg" });
    await expect(
      uploadTutorialImage(TOKEN, "test", "photo.jpg", blob),
    ).rejects.toThrow("Failed to upload image photo.jpg: 422");
  });
});

describe("checkPushAccess", () => {
  it("returns true for repo owner without API call", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    expect(await checkPushAccess(TOKEN, "test-owner")).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns true for repo owner case-insensitively", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    expect(await checkPushAccess(TOKEN, "Test-Owner")).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns true for admin permission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ permission: "admin" })));

    expect(await checkPushAccess(TOKEN, "someuser")).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/collaborators/someuser/permission",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it("returns true for write permission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ permission: "write" })));

    expect(await checkPushAccess(TOKEN, "writer")).toBe(true);
  });

  it("returns false for read permission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ permission: "read" })));

    expect(await checkPushAccess(TOKEN, "reader")).toBe(false);
  });

  it("returns false for none permission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ permission: "none" })));

    expect(await checkPushAccess(TOKEN, "nobody")).toBe(false);
  });

  it("returns false on API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 403)));

    expect(await checkPushAccess(TOKEN, "blocked")).toBe(false);
  });
});

describe("ensureFork", () => {
  it("creates fork and returns owner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ owner: { login: "contributor" } })),
    );

    const result = await ensureFork(TOKEN);

    expect(result).toEqual({ owner: "contributor" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/forks",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 403)));

    await expect(ensureFork(TOKEN)).rejects.toThrow("Failed to create fork: 403");
  });
});

describe("listForkBranches", () => {
  it("returns branches matching prefix", async () => {
    const branches = [
      { name: "main", commit: { sha: "aaa" } },
      { name: "tutorial/edit/olympus-om1-cla", commit: { sha: "bbb" } },
      { name: "tutorial/new/pentax-mx-cla", commit: { sha: "ccc" } },
      { name: "other-branch", commit: { sha: "ddd" } },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(branches)));

    const result = await listForkBranches(TOKEN, "contributor", "tutorial/");

    expect(result).toEqual([
      { name: "tutorial/edit/olympus-om1-cla", commitSha: "bbb" },
      { name: "tutorial/new/pentax-mx-cla", commitSha: "ccc" },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/contributor/test-repo/branches?per_page=100",
      expect.anything(),
    );
  });

  it("returns empty array on 404 (no fork)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 404)));

    const result = await listForkBranches(TOKEN, "contributor", "tutorial/");

    expect(result).toEqual([]);
  });

  it("throws on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 500)));

    await expect(listForkBranches(TOKEN, "contributor", "tutorial/")).rejects.toThrow("Failed to list branches: 500");
  });
});

describe("syncFork", () => {
  it("calls merge-upstream endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ message: "ok" })));

    await syncFork(TOKEN, "contributor");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/contributor/test-repo/merge-upstream",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.branch).toBe("main");
  });

  it("does not throw on 409 (already up to date)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 409)));

    await expect(syncFork(TOKEN, "contributor")).resolves.toBeUndefined();
  });

  it("throws on other errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 500)));

    await expect(syncFork(TOKEN, "contributor")).rejects.toThrow("Failed to sync fork: 500");
  });
});

describe("getRefSha", () => {
  it("returns the commit SHA for a branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ object: { sha: "abc123" } })),
    );

    const sha = await getRefSha(TOKEN, "test-owner", "main");

    expect(sha).toBe("abc123");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/git/ref/heads/main",
      expect.anything(),
    );
  });

  it("throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 404)));

    await expect(getRefSha(TOKEN, "test-owner", "missing")).rejects.toThrow("Failed to get ref missing: 404");
  });
});

describe("getCommitTreeSha", () => {
  it("returns the tree SHA for a commit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ tree: { sha: "tree-sha-456" } })),
    );

    const sha = await getCommitTreeSha(TOKEN, "test-owner", "commit-sha-123");

    expect(sha).toBe("tree-sha-456");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/git/commits/commit-sha-123",
      expect.anything(),
    );
  });
});

describe("createGitBlob", () => {
  it("creates a blob and returns SHA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ sha: "blob-sha-789" })),
    );

    const sha = await createGitBlob(TOKEN, "contributor", "hello world", "utf-8");

    expect(sha).toBe("blob-sha-789");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/contributor/test-repo/git/blobs",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.content).toBe("hello world");
    expect(body.encoding).toBe("utf-8");
  });
});

describe("createTree", () => {
  it("creates a tree with base and entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ sha: "tree-sha-new" })),
    );

    const entries = [{ path: "file.txt", mode: "100644" as const, type: "blob" as const, sha: "blob-sha" }];
    const sha = await createTree(TOKEN, "contributor", "base-tree-sha", entries);

    expect(sha).toBe("tree-sha-new");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.base_tree).toBe("base-tree-sha");
    expect(body.tree).toEqual(entries);
  });
});

describe("createCommit", () => {
  it("creates a commit and returns SHA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse({ sha: "commit-sha-new" })),
    );

    const sha = await createCommit(TOKEN, "contributor", "Add tutorial", "tree-sha", "parent-sha");

    expect(sha).toBe("commit-sha-new");
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.message).toBe("Add tutorial");
    expect(body.tree).toBe("tree-sha");
    expect(body.parents).toEqual(["parent-sha"]);
  });
});

describe("createRef", () => {
  it("creates a branch ref", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ ref: "refs/heads/tutorial/test" })));

    await createRef(TOKEN, "contributor", "tutorial/test", "commit-sha");

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.ref).toBe("refs/heads/tutorial/test");
    expect(body.sha).toBe("commit-sha");
  });

  it("throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 422)));

    await expect(createRef(TOKEN, "contributor", "bad", "sha")).rejects.toThrow("Failed to create branch bad: 422");
  });
});

describe("updateRef", () => {
  it("updates an existing branch ref", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ ref: "refs/heads/tutorial/test" })));

    await updateRef(TOKEN, "contributor", "tutorial/test", "new-commit-sha");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/contributor/test-repo/git/refs/heads/tutorial%2Ftest",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.sha).toBe("new-commit-sha");
    expect(body.force).toBe(true);
  });

  it("throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 422)));

    await expect(updateRef(TOKEN, "contributor", "bad", "sha")).rejects.toThrow("Failed to update branch bad: 422");
  });
});

describe("createPullRequest", () => {
  it("creates a PR and returns number + URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ number: 42, html_url: "https://github.com/test-owner/test-repo/pull/42" }),
      ),
    );

    const result = await createPullRequest(TOKEN, "Add tutorial: OM-1", "Description", "contributor:tutorial/om1", "main");

    expect(result).toEqual({ number: 42, html_url: "https://github.com/test-owner/test-repo/pull/42" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/test-owner/test-repo/pulls",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.title).toBe("Add tutorial: OM-1");
    expect(body.head).toBe("contributor:tutorial/om1");
    expect(body.base).toBe("main");
  });

  it("throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(null, 422)));

    await expect(
      createPullRequest(TOKEN, "title", "body", "head", "base"),
    ).rejects.toThrow("Failed to create pull request: 422");
  });
});


describe("saveToForkBranch", () => {
  it("first save: creates fork, syncs, creates branch", async () => {
    const mockFetch = vi.fn()
      // 1. ensureFork
      .mockResolvedValueOnce(jsonResponse({ owner: { login: "contributor" } }))
      // 2. createGitBlob (JSON)
      .mockResolvedValueOnce(jsonResponse({ sha: "json-blob-sha" }))
      // 3. syncFork
      .mockResolvedValueOnce(jsonResponse({ message: "ok" }))
      // 4. getRefSha (upstream base)
      .mockResolvedValueOnce(jsonResponse({ object: { sha: "base-commit-sha" } }))
      // 5. getCommitTreeSha (upstream base)
      .mockResolvedValueOnce(jsonResponse({ tree: { sha: "base-tree-sha" } }))
      // 6. createTree
      .mockResolvedValueOnce(jsonResponse({ sha: "new-tree-sha" }))
      // 7. createCommit
      .mockResolvedValueOnce(jsonResponse({ sha: "new-commit-sha" }))
      // 8. createRef
      .mockResolvedValueOnce(jsonResponse({ ref: "refs/heads/tutorial/test" }));

    vi.stubGlobal("fetch", mockFetch);

    const progressSteps: string[] = [];
    const result = await saveToForkBranch(
      TOKEN, "contributor", null, null, "tutorial/new/olympus-om1-cla", "olympus-om1-cla", sampleTutorial, [],
      (step) => progressSteps.push(step),
    );

    expect(result.forkOwner).toBe("contributor");
    expect(result.branchName).toBe("tutorial/new/olympus-om1-cla");
    expect(progressSteps).toContain("Creating fork...");
    expect(progressSteps).toContain("Syncing fork...");
    expect(progressSteps).toContain("Creating commit...");
    expect(mockFetch).toHaveBeenCalledTimes(8);
  });

  it("first save as repo owner: skips fork and sync", async () => {
    const mockFetch = vi.fn()
      // 1. createGitBlob (JSON)
      .mockResolvedValueOnce(jsonResponse({ sha: "json-blob-sha" }))
      // 2. getRefSha (upstream base)
      .mockResolvedValueOnce(jsonResponse({ object: { sha: "base-commit-sha" } }))
      // 3. getCommitTreeSha (upstream base)
      .mockResolvedValueOnce(jsonResponse({ tree: { sha: "base-tree-sha" } }))
      // 4. createTree
      .mockResolvedValueOnce(jsonResponse({ sha: "new-tree-sha" }))
      // 5. createCommit
      .mockResolvedValueOnce(jsonResponse({ sha: "new-commit-sha" }))
      // 6. createRef
      .mockResolvedValueOnce(jsonResponse({ ref: "refs/heads/tutorial/new/test" }));

    vi.stubGlobal("fetch", mockFetch);

    const progressSteps: string[] = [];
    const result = await saveToForkBranch(
      TOKEN, "test-owner", null, null, "tutorial/new/olympus-om1-cla", "olympus-om1-cla", sampleTutorial, [],
      (step) => progressSteps.push(step),
    );

    expect(result.forkOwner).toBe("test-owner");
    expect(result.branchName).toBe("tutorial/new/olympus-om1-cla");
    expect(progressSteps).not.toContain("Creating fork...");
    expect(progressSteps).not.toContain("Syncing fork...");
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it("subsequent save: commits on existing branch and updates ref", async () => {
    const mockFetch = vi.fn()
      // 1. createGitBlob (JSON)
      .mockResolvedValueOnce(jsonResponse({ sha: "json-blob-sha" }))
      // 2. getRefSha (branch tip)
      .mockResolvedValueOnce(jsonResponse({ object: { sha: "branch-tip-sha" } }))
      // 3. getCommitTreeSha (branch tip)
      .mockResolvedValueOnce(jsonResponse({ tree: { sha: "branch-tree-sha" } }))
      // 4. createTree
      .mockResolvedValueOnce(jsonResponse({ sha: "new-tree-sha" }))
      // 5. createCommit
      .mockResolvedValueOnce(jsonResponse({ sha: "new-commit-sha" }))
      // 6. updateRef
      .mockResolvedValueOnce(jsonResponse({ ref: "refs/heads/tutorial/existing" }));

    vi.stubGlobal("fetch", mockFetch);

    const progressSteps: string[] = [];
    const result = await saveToForkBranch(
      TOKEN, "contributor", "contributor", "tutorial/edit/olympus-om1-cla", "tutorial/edit/olympus-om1-cla", "olympus-om1-cla", sampleTutorial, [],
      (step) => progressSteps.push(step),
    );

    expect(result.forkOwner).toBe("contributor");
    expect(result.branchName).toBe("tutorial/edit/olympus-om1-cla");
    expect(progressSteps).not.toContain("Creating fork...");
    expect(progressSteps).not.toContain("Syncing fork...");
    expect(mockFetch).toHaveBeenCalledTimes(6);

    // Verify updateRef was called (last call)
    const lastCall = mockFetch.mock.calls[5];
    expect(lastCall[0]).toContain("git/refs/heads/");
    expect(lastCall[1].method).toBe("PATCH");
  });
});

describe("calculateResizeDimensions", () => {
  it("keeps small images unchanged", () => {
    expect(calculateResizeDimensions(800, 600, 2000)).toEqual({ width: 800, height: 600 });
  });

  it("scales down landscape images", () => {
    expect(calculateResizeDimensions(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
  });

  it("scales down portrait images", () => {
    expect(calculateResizeDimensions(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("scales down square images", () => {
    expect(calculateResizeDimensions(3000, 3000, 2000)).toEqual({ width: 2000, height: 2000 });
  });

  it("keeps images at exactly max dimension", () => {
    expect(calculateResizeDimensions(2000, 1500, 2000)).toEqual({ width: 2000, height: 1500 });
  });
});
