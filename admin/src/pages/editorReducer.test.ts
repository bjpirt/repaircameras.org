import { describe, it, expect } from "vitest";
import {
  editorReducer,
  initialState,
  buildAndValidate,
  collectPendingImages,
  type EditorState,
  type StepFormState,
} from "./editorReducer";

// --- Fixtures ---

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    ...initialState(false, "olympus-om1-cla"),
    title: "Olympus OM-1 Basic CLA",
    manufacturer: "Olympus",
    model: "OM-1",
    description: "A basic CLA.",
    tools: ["JIS screwdrivers"],
    steps: [
      {
        title: "Step 1",
        intro: "",
        substeps: [{ text: "Clean the lens." }],
        photos: [],
      },
    ],
    sha: "abc123",
    loading: false,
    ...overrides,
  };
}

// --- buildAndValidate ---

describe("buildAndValidate", () => {
  it("returns errors when ID is invalid for a new tutorial", () => {
    const state = makeState({ isNew: true, id: "INVALID ID!" });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors[0]).toMatch(/kebab-case/);
    }
  });

  it("returns errors when a step has no intro or substeps", () => {
    const state = makeState({
      steps: [{ title: "Step 1", intro: "", substeps: [], photos: [] }],
    });
    const result = buildAndValidate(state);
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors.some((e) => e.includes("Step must have"))).toBe(true);
    }
  });

  it("strips empty tools and empty substeps before validation", () => {
    const state = makeState({
      tools: ["JIS screwdrivers", "", "  "],
      steps: [
        {
          title: "Step 1",
          intro: "",
          substeps: [{ text: "Clean the lens." }, { text: "  " }],
          photos: [],
        },
      ],
    });
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.tools).toEqual(["JIS screwdrivers"]);
      expect(result.data.steps[0].substeps).toEqual([{ text: "Clean the lens." }]);
    }
  });

  it("returns validated Tutorial data on valid input", () => {
    const state = makeState();
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.title).toBe("Olympus OM-1 Basic CLA");
      expect(result.data.id).toBe("olympus-om1-cla");
    }
  });

  it("converts empty intro string to undefined in the output", () => {
    const state = makeState();
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.steps[0].intro).toBeUndefined();
    }
  });
});

// --- collectPendingImages ---

describe("collectPendingImages", () => {
  it("returns an empty array when no photos have pending blobs", () => {
    const steps: StepFormState[] = [
      {
        title: "Step 1",
        intro: "",
        substeps: [],
        photos: [{ filename: "photo.jpg", alt: "", annotations: [], imageUrl: "https://example.com/photo.jpg" }],
      },
    ];
    expect(collectPendingImages(steps)).toEqual([]);
  });

  it("returns pending blobs from all steps", () => {
    const blob1 = new Blob(["a"]);
    const blob2 = new Blob(["b"]);
    const steps: StepFormState[] = [
      {
        title: "Step 1",
        intro: "",
        substeps: [],
        photos: [
          { filename: "a.jpg", alt: "", annotations: [], imageUrl: "blob:a", pendingBlob: blob1 },
          { filename: "existing.jpg", alt: "", annotations: [], imageUrl: "https://existing.jpg" },
        ],
      },
      {
        title: "Step 2",
        intro: "",
        substeps: [],
        photos: [
          { filename: "b.jpg", alt: "", annotations: [], imageUrl: "blob:b", pendingBlob: blob2 },
        ],
      },
    ];
    const result = collectPendingImages(steps);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ filename: "a.jpg", blob: blob1 });
    expect(result[1]).toEqual({ filename: "b.jpg", blob: blob2 });
  });
});

// --- editorReducer spot checks ---

describe("editorReducer", () => {
  it("LOAD_TUTORIAL populates fields and clears loading/isDirty", () => {
    const base = initialState(false, "olympus-om1-cla");
    const next = editorReducer(base, {
      type: "LOAD_TUTORIAL",
      tutorial: {
        id: "olympus-om1-cla",
        title: "Olympus OM-1 Basic CLA",
        manufacturer: "Olympus",
        model: "OM-1",
        description: "A basic CLA.",
        tools: ["JIS screwdrivers"],
        steps: [{ title: "Step 1", substeps: [{ text: "Clean." }], photos: [] }],
      },
      images: [],
      sha: "abc123",
    });
    expect(next.title).toBe("Olympus OM-1 Basic CLA");
    expect(next.loading).toBe(false);
    expect(next.isDirty).toBe(false);
    expect(next.sha).toBe("abc123");
  });

  it("MOVE_STEP reorders steps correctly", () => {
    const state = makeState({
      steps: [
        { title: "A", intro: "", substeps: [], photos: [] },
        { title: "B", intro: "", substeps: [], photos: [] },
        { title: "C", intro: "", substeps: [], photos: [] },
      ],
    });
    const next = editorReducer(state, { type: "MOVE_STEP", from: 0, to: 2 });
    expect(next.steps.map((s) => s.title)).toEqual(["B", "C", "A"]);
    expect(next.isDirty).toBe(true);
  });

  it("SET_SAVING clears errors and validationErrors", () => {
    const state = makeState({ error: "old error", validationErrors: ["bad field"] });
    const next = editorReducer(state, { type: "SET_SAVING", value: true });
    expect(next.saving).toBe(true);
    expect(next.error).toBeNull();
    expect(next.validationErrors).toEqual([]);
  });

  it("SET_FIELD marks isDirty and clears saveSuccess", () => {
    const state = makeState({ saveSuccess: true, isDirty: false });
    const next = editorReducer(state, { type: "SET_FIELD", field: "title", value: "New Title" });
    expect(next.title).toBe("New Title");
    expect(next.isDirty).toBe(true);
    expect(next.saveSuccess).toBe(false);
  });

  it("ADD_PREREQUISITE adds a prerequisite and marks dirty", () => {
    const state = makeState();
    const next = editorReducer(state, { type: "ADD_PREREQUISITE", id: "om10-remove-top-cover" });
    expect(next.prerequisites).toEqual(["om10-remove-top-cover"]);
    expect(next.isDirty).toBe(true);
  });

  it("ADD_PREREQUISITE does not add duplicates", () => {
    const state = makeState({ prerequisites: ["om10-remove-top-cover"] });
    const next = editorReducer(state, { type: "ADD_PREREQUISITE", id: "om10-remove-top-cover" });
    expect(next.prerequisites).toEqual(["om10-remove-top-cover"]);
  });

  it("REMOVE_PREREQUISITE removes by index", () => {
    const state = makeState({ prerequisites: ["a", "b", "c"] });
    const next = editorReducer(state, { type: "REMOVE_PREREQUISITE", index: 1 });
    expect(next.prerequisites).toEqual(["a", "c"]);
    expect(next.isDirty).toBe(true);
  });

  it("LOAD_TUTORIAL populates prerequisites", () => {
    const base = initialState(false, "test");
    const next = editorReducer(base, {
      type: "LOAD_TUTORIAL",
      tutorial: {
        id: "test",
        title: "Test",
        manufacturer: "Test",
        model: "T1",
        description: "desc",
        tools: [],
        prerequisites: ["om10-remove-top-cover"],
        steps: [{ title: "Step 1", substeps: [{ text: "Do thing." }], photos: [] }],
      },
      images: [],
      sha: "abc",
    });
    expect(next.prerequisites).toEqual(["om10-remove-top-cover"]);
  });
});

describe("buildAndValidate with prerequisites", () => {
  it("includes prerequisites in validated output", () => {
    const state = makeState({ prerequisites: ["om10-remove-top-cover"] });
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.prerequisites).toEqual(["om10-remove-top-cover"]);
    }
  });

  it("omits prerequisites when empty", () => {
    const state = makeState({ prerequisites: [] });
    const result = buildAndValidate(state);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      // Default from Zod will apply
      expect(result.data.prerequisites).toEqual([]);
    }
  });
});
