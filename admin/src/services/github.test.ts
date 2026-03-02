import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTutorialFiles,
  fetchTutorialJson,
  listTutorialImages,
  saveTutorial,
  createTutorial,
  uploadTutorialImage,
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
