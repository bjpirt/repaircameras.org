import { describe, it, expect } from "vitest";
import {
  cameraEditorReducer,
  createInitialState,
  buildAndValidate,
  type CameraEditorState,
} from "./cameraEditorReducer";

function makeState(overrides: Partial<CameraEditorState> = {}): CameraEditorState {
  return {
    ...createInitialState("nikon", "fe", false),
    manufacturer: "Nikon",
    model: "FE",
    body: "A classic SLR.",
    relatedFiles: [],
    relatedLinks: [],
    troubleshooting: [],
    sha: "abc123",
    loading: false,
    ...overrides,
  };
}

// --- buildAndValidate ---

describe("buildAndValidate", () => {
  it("returns validated CameraPage data on valid input", () => {
    const state = makeState();
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.manufacturer).toBe("Nikon");
      expect(result.data.model).toBe("FE");
      expect(result.data.body).toBe("A classic SLR.");
    }
  });

  it("returns errors when manufacturer is empty", () => {
    const state = makeState({ manufacturer: "" });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
  });

  it("returns errors when model is empty", () => {
    const state = makeState({ model: "" });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
  });

  it("validates slug fields for new cameras", () => {
    const state = makeState({
      isNew: true,
      manufacturerSlug: "INVALID SLUG",
      modelSlug: "valid-slug",
    });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.some((e) => e.includes("Manufacturer slug"))).toBe(true);
    }
  });

  it("validates model slug for new cameras", () => {
    const state = makeState({
      isNew: true,
      manufacturerSlug: "valid",
      modelSlug: "BAD SLUG!",
    });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.some((e) => e.includes("Model slug"))).toBe(true);
    }
  });

  it("requires slug fields for new cameras", () => {
    const state = makeState({
      isNew: true,
      manufacturerSlug: "",
      modelSlug: "",
    });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.some((e) => e.includes("Manufacturer slug is required"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Model slug is required"))).toBe(true);
    }
  });

  it("does not validate slugs for existing cameras", () => {
    const state = makeState({ isNew: false });
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
  });

  it("validates new links require id, url, title, and thumbnail", () => {
    const state = makeState({
      newLinks: [
        { id: "", title: "", url: "", description: "", thumbnailBlob: null, thumbnailPreview: null },
      ],
    });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.some((e) => e.includes("ID is required"))).toBe(true);
      expect(result.errors.some((e) => e.includes("URL is required"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Title is required"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Thumbnail is required"))).toBe(true);
    }
  });

  it("auto-adds valid new link IDs to relatedLinks", () => {
    const blob = new Blob(["img"]);
    const state = makeState({
      relatedLinks: ["existing-link"],
      newLinks: [
        { id: "new-link", title: "New", url: "https://example.com", description: "desc", thumbnailBlob: blob, thumbnailPreview: "blob:preview" },
      ],
    });
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.relatedLinks).toEqual(["existing-link", "new-link"]);
      expect(result.newLinkIds).toEqual(["new-link"]);
    }
  });

  it("does not duplicate link IDs already in relatedLinks", () => {
    const blob = new Blob(["img"]);
    const state = makeState({
      relatedLinks: ["my-link"],
      newLinks: [
        { id: "my-link", title: "Link", url: "https://example.com", description: "", thumbnailBlob: blob, thumbnailPreview: "blob:x" },
      ],
    });
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.relatedLinks).toEqual(["my-link"]);
    }
  });
});

// --- cameraEditorReducer ---

describe("cameraEditorReducer", () => {
  it("LOAD_CAMERA populates fields and clears loading/isDirty", () => {
    const base = createInitialState("nikon", "fe", false);
    const next = cameraEditorReducer(base, {
      type: "LOAD_CAMERA",
      cameraPage: {
        manufacturer: "Nikon",
        model: "FE",
        body: "Description",
        relatedFiles: ["manual-1"],
        relatedLinks: ["link-1"],
        troubleshooting: [{ symptom: "S", cause: "C", solution: "X" }],
      },
      sha: "abc123",
    });
    expect(next.manufacturer).toBe("Nikon");
    expect(next.model).toBe("FE");
    expect(next.body).toBe("Description");
    expect(next.relatedFiles).toEqual(["manual-1"]);
    expect(next.relatedLinks).toEqual(["link-1"]);
    expect(next.troubleshooting).toHaveLength(1);
    expect(next.loading).toBe(false);
    expect(next.isDirty).toBe(false);
    expect(next.sha).toBe("abc123");
  });

  it("SET_FIELD marks isDirty and clears saveSuccess", () => {
    const state = makeState({ saveSuccess: true, isDirty: false });
    const next = cameraEditorReducer(state, { type: "SET_FIELD", field: "manufacturer", value: "Canon" });
    expect(next.manufacturer).toBe("Canon");
    expect(next.isDirty).toBe(true);
    expect(next.saveSuccess).toBe(false);
  });

  it("ADD_RELATED_FILE adds a file and marks dirty", () => {
    const state = makeState({ relatedFiles: [] });
    const next = cameraEditorReducer(state, { type: "ADD_RELATED_FILE", fileId: "manual-1" });
    expect(next.relatedFiles).toEqual(["manual-1"]);
    expect(next.isDirty).toBe(true);
  });

  it("ADD_RELATED_FILE does not add duplicates", () => {
    const state = makeState({ relatedFiles: ["manual-1"] });
    const next = cameraEditorReducer(state, { type: "ADD_RELATED_FILE", fileId: "manual-1" });
    expect(next.relatedFiles).toEqual(["manual-1"]);
    expect(next).toBe(state); // same reference
  });

  it("REMOVE_RELATED_FILE removes a file", () => {
    const state = makeState({ relatedFiles: ["a", "b", "c"] });
    const next = cameraEditorReducer(state, { type: "REMOVE_RELATED_FILE", fileId: "b" });
    expect(next.relatedFiles).toEqual(["a", "c"]);
    expect(next.isDirty).toBe(true);
  });

  it("ADD_RELATED_LINK adds a link", () => {
    const state = makeState({ relatedLinks: [] });
    const next = cameraEditorReducer(state, { type: "ADD_RELATED_LINK", linkId: "link-1" });
    expect(next.relatedLinks).toEqual(["link-1"]);
    expect(next.isDirty).toBe(true);
  });

  it("ADD_RELATED_LINK does not add duplicates", () => {
    const state = makeState({ relatedLinks: ["link-1"] });
    const next = cameraEditorReducer(state, { type: "ADD_RELATED_LINK", linkId: "link-1" });
    expect(next).toBe(state);
  });

  it("REMOVE_RELATED_LINK removes a link", () => {
    const state = makeState({ relatedLinks: ["a", "b"] });
    const next = cameraEditorReducer(state, { type: "REMOVE_RELATED_LINK", linkId: "a" });
    expect(next.relatedLinks).toEqual(["b"]);
  });

  it("ADD_TROUBLESHOOTING adds an empty entry", () => {
    const state = makeState({ troubleshooting: [] });
    const next = cameraEditorReducer(state, { type: "ADD_TROUBLESHOOTING" });
    expect(next.troubleshooting).toHaveLength(1);
    expect(next.troubleshooting[0]).toEqual({ symptom: "", cause: "", solution: "" });
    expect(next.isDirty).toBe(true);
  });

  it("REMOVE_TROUBLESHOOTING removes by index", () => {
    const state = makeState({
      troubleshooting: [
        { symptom: "A", cause: "B", solution: "C" },
        { symptom: "D", cause: "E", solution: "F" },
      ],
    });
    const next = cameraEditorReducer(state, { type: "REMOVE_TROUBLESHOOTING", index: 0 });
    expect(next.troubleshooting).toHaveLength(1);
    expect(next.troubleshooting[0].symptom).toBe("D");
  });

  it("UPDATE_TROUBLESHOOTING updates a specific field", () => {
    const state = makeState({
      troubleshooting: [{ symptom: "A", cause: "B", solution: "C" }],
    });
    const next = cameraEditorReducer(state, {
      type: "UPDATE_TROUBLESHOOTING",
      index: 0,
      field: "symptom",
      value: "Updated",
    });
    expect(next.troubleshooting[0].symptom).toBe("Updated");
    expect(next.troubleshooting[0].cause).toBe("B");
    expect(next.isDirty).toBe(true);
  });

  it("ADD_NEW_LINK adds an empty new link form", () => {
    const state = makeState({ newLinks: [] });
    const next = cameraEditorReducer(state, { type: "ADD_NEW_LINK" });
    expect(next.newLinks).toHaveLength(1);
    expect(next.newLinks[0].id).toBe("");
    expect(next.newLinks[0].url).toBe("");
  });

  it("UPDATE_NEW_LINK updates a field on a new link", () => {
    const state = makeState({
      newLinks: [{ id: "", title: "", url: "", description: "", thumbnailBlob: null, thumbnailPreview: null }],
    });
    const next = cameraEditorReducer(state, {
      type: "UPDATE_NEW_LINK",
      index: 0,
      field: "url",
      value: "https://youtube.com/watch?v=abc",
    });
    expect(next.newLinks[0].url).toBe("https://youtube.com/watch?v=abc");
  });

  it("REMOVE_NEW_LINK removes by index", () => {
    const state = makeState({
      newLinks: [
        { id: "a", title: "A", url: "u", description: "", thumbnailBlob: null, thumbnailPreview: null },
        { id: "b", title: "B", url: "u", description: "", thumbnailBlob: null, thumbnailPreview: null },
      ],
    });
    const next = cameraEditorReducer(state, { type: "REMOVE_NEW_LINK", index: 0 });
    expect(next.newLinks).toHaveLength(1);
    expect(next.newLinks[0].id).toBe("b");
  });

  it("SET_SAVE_SUCCESS clears isDirty and newLinks", () => {
    const state = makeState({
      isDirty: true,
      saving: true,
      newLinks: [{ id: "x", title: "", url: "", description: "", thumbnailBlob: null, thumbnailPreview: null }],
    });
    const next = cameraEditorReducer(state, { type: "SET_SAVE_SUCCESS" });
    expect(next.saveSuccess).toBe(true);
    expect(next.isDirty).toBe(false);
    expect(next.saving).toBe(false);
    expect(next.newLinks).toEqual([]);
  });

  it("SET_ERROR clears loading and saving", () => {
    const state = makeState({ loading: true, saving: true });
    const next = cameraEditorReducer(state, { type: "SET_ERROR", error: "Something broke" });
    expect(next.error).toBe("Something broke");
    expect(next.loading).toBe(false);
    expect(next.saving).toBe(false);
  });

  it("SET_VALIDATION_ERRORS stores errors and clears saving", () => {
    const state = makeState({ saving: true });
    const next = cameraEditorReducer(state, { type: "SET_VALIDATION_ERRORS", errors: ["Field required"] });
    expect(next.validationErrors).toEqual(["Field required"]);
    expect(next.saving).toBe(false);
  });

  it("SET_PR_RESULT stores result and clears progress", () => {
    const state = makeState({ saving: true, prProgress: "Creating PR..." });
    const next = cameraEditorReducer(state, {
      type: "SET_PR_RESULT",
      result: { number: 42, html_url: "https://github.com/test/repo/pull/42" },
    });
    expect(next.prResult).toEqual({ number: 42, html_url: "https://github.com/test/repo/pull/42" });
    expect(next.prProgress).toBeNull();
    expect(next.saving).toBe(false);
  });

  it("SET_FORK_BRANCH stores fork owner and branch name", () => {
    const state = makeState();
    const next = cameraEditorReducer(state, {
      type: "SET_FORK_BRANCH",
      forkOwner: "user",
      branchName: "camera/edit/nikon/fe",
    });
    expect(next.forkOwner).toBe("user");
    expect(next.branchName).toBe("camera/edit/nikon/fe");
  });
});
