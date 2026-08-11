import {
  CameraPageSchema,
  type CameraPage,
  type TroubleshootingEntry,
} from "@shared/types/cameraPage";

export interface NewLinkFormState {
  id: string;
  title: string;
  url: string;
  description: string;
  thumbnailBlob: Blob | null;
  thumbnailPreview: string | null;
}

export interface PullRequestResult {
  number: number;
  html_url: string;
}

export interface CameraEditorState {
  manufacturerSlug: string;
  modelSlug: string;
  isNew: boolean;

  manufacturer: string;
  model: string;
  body: string;
  relatedFiles: string[];
  relatedLinks: string[];
  // Preserved from the loaded page; not editable in the UI yet
  relatedArchives: string[];
  troubleshooting: TroubleshootingEntry[];

  newLinks: NewLinkFormState[];

  availablePdfs: string[];
  availableLinks: string[];
  existingManufacturers: string[];

  loading: boolean;
  saving: boolean;
  isDirty: boolean;
  error: string | null;
  validationErrors: string[];
  saveSuccess: boolean;
  prProgress: string | null;
  prResult: PullRequestResult | null;
  forkOwner: string | null;
  branchName: string | null;
  sha: string | null;
}

export type CameraEditorAction =
  | { type: "LOAD_CAMERA"; cameraPage: CameraPage; sha: string }
  | { type: "SET_FIELD"; field: "manufacturer" | "model" | "body" | "manufacturerSlug" | "modelSlug"; value: string }
  | { type: "ADD_RELATED_FILE"; fileId: string }
  | { type: "REMOVE_RELATED_FILE"; fileId: string }
  | { type: "ADD_RELATED_LINK"; linkId: string }
  | { type: "REMOVE_RELATED_LINK"; linkId: string }
  | { type: "ADD_TROUBLESHOOTING" }
  | { type: "REMOVE_TROUBLESHOOTING"; index: number }
  | { type: "UPDATE_TROUBLESHOOTING"; index: number; field: keyof TroubleshootingEntry; value: string }
  | { type: "ADD_NEW_LINK" }
  | { type: "REMOVE_NEW_LINK"; index: number }
  | { type: "UPDATE_NEW_LINK"; index: number; field: "id" | "title" | "url" | "description"; value: string }
  | { type: "SET_NEW_LINK_THUMBNAIL"; index: number; blob: Blob; preview: string }
  | { type: "SET_AVAILABLE_PDFS"; pdfs: string[] }
  | { type: "SET_AVAILABLE_LINKS"; links: string[] }
  | { type: "SET_EXISTING_MANUFACTURERS"; manufacturers: string[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_VALIDATION_ERRORS"; errors: string[] }
  | { type: "SET_SAVE_SUCCESS" }
  | { type: "CLEAR_SAVE_SUCCESS" }
  | { type: "SET_PR_PROGRESS"; message: string }
  | { type: "SET_PR_RESULT"; result: PullRequestResult }
  | { type: "SET_FORK_BRANCH"; forkOwner: string; branchName: string };

export function createInitialState(
  manufacturerSlug: string,
  modelSlug: string,
  isNew: boolean,
): CameraEditorState {
  return {
    manufacturerSlug,
    modelSlug,
    isNew,
    manufacturer: "",
    model: "",
    body: "",
    relatedFiles: [],
    relatedLinks: [],
    relatedArchives: [],
    troubleshooting: [],
    newLinks: [],
    availablePdfs: [],
    availableLinks: [],
    existingManufacturers: [],
    loading: !isNew,
    saving: false,
    isDirty: false,
    error: null,
    validationErrors: [],
    saveSuccess: false,
    prProgress: null,
    prResult: null,
    forkOwner: null,
    branchName: null,
    sha: null,
  };
}

export function cameraEditorReducer(
  state: CameraEditorState,
  action: CameraEditorAction,
): CameraEditorState {
  switch (action.type) {
    case "LOAD_CAMERA":
      return {
        ...state,
        manufacturer: action.cameraPage.manufacturer,
        model: action.cameraPage.model,
        body: action.cameraPage.body,
        relatedFiles: action.cameraPage.relatedFiles,
        relatedLinks: action.cameraPage.relatedLinks,
        relatedArchives: action.cameraPage.relatedArchives,
        troubleshooting: action.cameraPage.troubleshooting,
        sha: action.sha,
        loading: false,
        isDirty: false,
      };

    case "SET_FIELD":
      return { ...state, [action.field]: action.value, isDirty: true, saveSuccess: false };

    case "ADD_RELATED_FILE":
      if (state.relatedFiles.includes(action.fileId)) return state;
      return { ...state, relatedFiles: [...state.relatedFiles, action.fileId], isDirty: true, saveSuccess: false };

    case "REMOVE_RELATED_FILE":
      return { ...state, relatedFiles: state.relatedFiles.filter((f) => f !== action.fileId), isDirty: true, saveSuccess: false };

    case "ADD_RELATED_LINK":
      if (state.relatedLinks.includes(action.linkId)) return state;
      return { ...state, relatedLinks: [...state.relatedLinks, action.linkId], isDirty: true, saveSuccess: false };

    case "REMOVE_RELATED_LINK":
      return { ...state, relatedLinks: state.relatedLinks.filter((l) => l !== action.linkId), isDirty: true, saveSuccess: false };

    case "ADD_TROUBLESHOOTING":
      return {
        ...state,
        troubleshooting: [...state.troubleshooting, { symptom: "", cause: "", solution: "" }],
        isDirty: true,
        saveSuccess: false,
      };

    case "REMOVE_TROUBLESHOOTING":
      return {
        ...state,
        troubleshooting: state.troubleshooting.filter((_, i) => i !== action.index),
        isDirty: true,
        saveSuccess: false,
      };

    case "UPDATE_TROUBLESHOOTING":
      return {
        ...state,
        troubleshooting: state.troubleshooting.map((entry, i) =>
          i === action.index ? { ...entry, [action.field]: action.value } : entry,
        ),
        isDirty: true,
        saveSuccess: false,
      };

    case "ADD_NEW_LINK":
      return {
        ...state,
        newLinks: [
          ...state.newLinks,
          { id: "", title: "", url: "", description: "", thumbnailBlob: null, thumbnailPreview: null },
        ],
        isDirty: true,
        saveSuccess: false,
      };

    case "REMOVE_NEW_LINK": {
      const link = state.newLinks[action.index];
      if (link?.thumbnailPreview) URL.revokeObjectURL(link.thumbnailPreview);
      return {
        ...state,
        newLinks: state.newLinks.filter((_, i) => i !== action.index),
        isDirty: true,
        saveSuccess: false,
      };
    }

    case "UPDATE_NEW_LINK":
      return {
        ...state,
        newLinks: state.newLinks.map((link, i) =>
          i === action.index ? { ...link, [action.field]: action.value } : link,
        ),
        isDirty: true,
        saveSuccess: false,
      };

    case "SET_NEW_LINK_THUMBNAIL":
      return {
        ...state,
        newLinks: state.newLinks.map((link, i) =>
          i === action.index
            ? { ...link, thumbnailBlob: action.blob, thumbnailPreview: action.preview }
            : link,
        ),
        isDirty: true,
        saveSuccess: false,
      };

    case "SET_AVAILABLE_PDFS":
      return { ...state, availablePdfs: action.pdfs };

    case "SET_AVAILABLE_LINKS":
      return { ...state, availableLinks: action.links };

    case "SET_EXISTING_MANUFACTURERS":
      return { ...state, existingManufacturers: action.manufacturers };

    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "SET_SAVING":
      return { ...state, saving: action.saving };

    case "SET_ERROR":
      return { ...state, error: action.error, loading: false, saving: false };

    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.errors, saving: false };

    case "SET_SAVE_SUCCESS":
      return { ...state, saveSuccess: true, saving: false, isDirty: false, newLinks: [], prProgress: null };

    case "CLEAR_SAVE_SUCCESS":
      return { ...state, saveSuccess: false };

    case "SET_PR_PROGRESS":
      return { ...state, prProgress: action.message };

    case "SET_PR_RESULT":
      return { ...state, prResult: action.result, prProgress: null, saving: false };

    case "SET_FORK_BRANCH":
      return { ...state, forkOwner: action.forkOwner, branchName: action.branchName };
  }
}

export function buildAndValidate(
  state: CameraEditorState,
): { data: CameraPage; newLinkIds: string[] } | { errors: string[] } {
  const errors: string[] = [];

  // Validate new links
  const validNewLinks: string[] = [];
  for (const [i, link] of state.newLinks.entries()) {
    if (!link.id) errors.push(`New link ${i + 1}: ID is required`);
    if (!link.url) errors.push(`New link ${i + 1}: URL is required`);
    if (!link.title) errors.push(`New link ${i + 1}: Title is required`);
    if (!link.thumbnailBlob) errors.push(`New link ${i + 1}: Thumbnail is required`);
    if (link.id) validNewLinks.push(link.id);
  }

  // Validate slug fields for new cameras
  if (state.isNew) {
    if (!state.manufacturerSlug) errors.push("Manufacturer slug is required");
    if (!state.modelSlug) errors.push("Model slug is required");
    if (state.manufacturerSlug && !/^[a-z0-9-]+$/.test(state.manufacturerSlug)) {
      errors.push("Manufacturer slug must be lowercase letters, numbers, and hyphens");
    }
    if (state.modelSlug && !/^[a-z0-9-]+$/.test(state.modelSlug)) {
      errors.push("Model slug must be lowercase letters, numbers, and hyphens");
    }
  }

  // Combine existing relatedLinks with new link IDs
  const allRelatedLinks = [
    ...state.relatedLinks,
    ...validNewLinks.filter((id) => !state.relatedLinks.includes(id)),
  ];

  const cameraData: CameraPage = {
    manufacturer: state.manufacturer,
    model: state.model,
    body: state.body,
    relatedFiles: state.relatedFiles,
    relatedLinks: allRelatedLinks,
    relatedArchives: state.relatedArchives,
    troubleshooting: state.troubleshooting,
  };

  const result = CameraPageSchema.safeParse(cameraData);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(issue.message);
    }
  }

  if (errors.length > 0) return { errors };

  return { data: result!.data!, newLinkIds: validNewLinks };
}
