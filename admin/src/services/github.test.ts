import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listTutorialFiles,
  fetchTutorialJson,
  listTutorialImages,
} from "./github";

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
  it("decodes base64 content and parses with Zod", async () => {
    const encoded = base64Encode(JSON.stringify(sampleTutorialJson));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ content: encoded, encoding: "base64", sha: "abc" }),
      ),
    );

    const tutorial = await fetchTutorialJson(TOKEN, "olympus-om1-cla");

    expect(tutorial.id).toBe("olympus-om1-cla");
    expect(tutorial.title).toBe("Olympus OM-1 Basic CLA");
    expect(tutorial.manufacturer).toBe("Olympus");
    expect(tutorial.steps).toHaveLength(1);
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

    const tutorial = await fetchTutorialJson(TOKEN, "test-tutorial");

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
