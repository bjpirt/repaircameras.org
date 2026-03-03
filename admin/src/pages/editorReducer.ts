import { TutorialSchema, type Tutorial, type Annotation } from "@shared/types/tutorial";
import type { TutorialImageEntry, PendingImage } from "../services/github";

// --- Types ---

export interface PhotoFormState {
  filename: string;
  alt: string;
  annotations: Annotation[];
  imageUrl: string | null;
  pendingBlob?: Blob;
}

export interface StepFormState {
  title: string;
  intro: string;
  substeps: { text: string }[];
  photos: PhotoFormState[];
}

export interface EditorState {
  id: string;
  isNew: boolean;
  title: string;
  manufacturer: string;
  model: string;
  description: string;
  tools: string[];
  steps: StepFormState[];
  sha: string | null;
  images: TutorialImageEntry[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  validationErrors: string[];
  saveSuccess: boolean;
  prProgress: string | null;
  prResult: PullRequestResult | null;
  forkOwner: string | null;
  branchName: string | null;
  isDirty: boolean;
}

export interface PullRequestResult {
  number: number;
  html_url: string;
}

export type EditorAction =
  | { type: "LOAD_TUTORIAL"; tutorial: { id: string; title: string; manufacturer: string; model: string; description: string; tools: string[]; steps: { title: string; intro?: string; substeps: { text: string }[]; photos: { filename: string; alt: string; annotations: Annotation[] }[] }[] }; images: TutorialImageEntry[]; sha: string }
  | { type: "SET_FIELD"; field: "title" | "manufacturer" | "model" | "description"; value: string }
  | { type: "SET_ID"; value: string }
  | { type: "ADD_TOOL" }
  | { type: "REMOVE_TOOL"; index: number }
  | { type: "UPDATE_TOOL"; index: number; value: string }
  | { type: "ADD_STEP" }
  | { type: "REMOVE_STEP"; index: number }
  | { type: "MOVE_STEP"; from: number; to: number }
  | { type: "SET_STEP_FIELD"; stepIndex: number; field: "title" | "intro"; value: string }
  | { type: "ADD_SUBSTEP"; stepIndex: number }
  | { type: "REMOVE_SUBSTEP"; stepIndex: number; substepIndex: number }
  | { type: "UPDATE_SUBSTEP"; stepIndex: number; substepIndex: number; value: string }
  | { type: "ADD_PHOTO"; stepIndex: number; photo: PhotoFormState }
  | { type: "REMOVE_PHOTO"; stepIndex: number; photoIndex: number }
  | { type: "UPDATE_PHOTO_ALT"; stepIndex: number; photoIndex: number; value: string }
  | { type: "SET_PHOTO_ANNOTATIONS"; stepIndex: number; photoIndex: number; annotations: Annotation[] }
  | { type: "MOVE_PHOTO"; stepIndex: number; from: number; to: number }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_VALIDATION_ERRORS"; errors: string[] }
  | { type: "SET_SAVE_SUCCESS"; value: boolean }
  | { type: "UPDATE_SHA"; sha: string }
  | { type: "SET_PR_PROGRESS"; step: string }
  | { type: "SET_PR_RESULT"; result: PullRequestResult }
  | { type: "SET_FORK_BRANCH"; forkOwner: string; branchName: string }
  | { type: "SET_DIRTY"; value: boolean };

// --- Constants ---

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// --- Initial state ---

export function initialState(isNew: boolean, id: string): EditorState {
  return {
    id,
    isNew,
    title: "",
    manufacturer: "",
    model: "",
    description: "",
    tools: [],
    steps: [],
    sha: null,
    images: [],
    loading: !isNew,
    saving: false,
    error: null,
    validationErrors: [],
    saveSuccess: false,
    prProgress: null,
    prResult: null,
    forkOwner: null,
    branchName: null,
    isDirty: false,
  };
}

// --- Reducer ---

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "LOAD_TUTORIAL": {
      const imageMap = new Map(action.images.map((img) => [img.name, img.download_url]));
      return {
        ...state,
        id: action.tutorial.id,
        title: action.tutorial.title,
        manufacturer: action.tutorial.manufacturer,
        model: action.tutorial.model,
        description: action.tutorial.description,
        tools: action.tutorial.tools,
        steps: action.tutorial.steps.map((step) => ({
          title: step.title,
          intro: step.intro ?? "",
          substeps: step.substeps,
          photos: step.photos.map((photo) => ({
            filename: photo.filename,
            alt: photo.alt,
            annotations: photo.annotations,
            imageUrl: imageMap.get(photo.filename) ?? null,
          })),
        })),
        sha: action.sha,
        images: action.images,
        loading: false,
        isDirty: false,
      };
    }
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, saveSuccess: false, isDirty: true };
    case "SET_ID":
      return { ...state, id: action.value, saveSuccess: false, isDirty: true };
    case "ADD_TOOL":
      return { ...state, tools: [...state.tools, ""], saveSuccess: false, isDirty: true };
    case "REMOVE_TOOL":
      return { ...state, tools: state.tools.filter((_, i) => i !== action.index), saveSuccess: false, isDirty: true };
    case "UPDATE_TOOL":
      return { ...state, tools: state.tools.map((t, i) => (i === action.index ? action.value : t)), saveSuccess: false, isDirty: true };
    case "ADD_STEP":
      return {
        ...state,
        steps: [...state.steps, { title: "", intro: "", substeps: [], photos: [] }],
        saveSuccess: false, isDirty: true,
      };
    case "REMOVE_STEP":
      return { ...state, steps: state.steps.filter((_, i) => i !== action.index), saveSuccess: false, isDirty: true };
    case "MOVE_STEP": {
      const steps = [...state.steps];
      const [moved] = steps.splice(action.from, 1);
      steps.splice(action.to, 0, moved);
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "SET_STEP_FIELD": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex ? { ...step, [action.field]: action.value } : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "ADD_SUBSTEP": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex
          ? { ...step, substeps: [...step.substeps, { text: "" }] }
          : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "REMOVE_SUBSTEP": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex
          ? { ...step, substeps: step.substeps.filter((_, j) => j !== action.substepIndex) }
          : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "UPDATE_SUBSTEP": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex
          ? {
              ...step,
              substeps: step.substeps.map((ss, j) =>
                j === action.substepIndex ? { text: action.value } : ss,
              ),
            }
          : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "ADD_PHOTO": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex ? { ...step, photos: [...step.photos, action.photo] } : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "REMOVE_PHOTO": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex
          ? { ...step, photos: step.photos.filter((_, j) => j !== action.photoIndex) }
          : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "UPDATE_PHOTO_ALT": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex
          ? {
              ...step,
              photos: step.photos.map((p, j) =>
                j === action.photoIndex ? { ...p, alt: action.value } : p,
              ),
            }
          : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "SET_PHOTO_ANNOTATIONS": {
      const steps = state.steps.map((step, i) =>
        i === action.stepIndex
          ? {
              ...step,
              photos: step.photos.map((p, j) =>
                j === action.photoIndex ? { ...p, annotations: action.annotations } : p,
              ),
            }
          : step,
      );
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "MOVE_PHOTO": {
      const steps = state.steps.map((step, i) => {
        if (i !== action.stepIndex) return step;
        const photos = [...step.photos];
        const [moved] = photos.splice(action.from, 1);
        photos.splice(action.to, 0, moved);
        return { ...step, photos };
      });
      return { ...state, steps, saveSuccess: false, isDirty: true };
    }
    case "SET_SAVING":
      return { ...state, saving: action.value, error: null, validationErrors: [] };
    case "SET_ERROR":
      return { ...state, error: action.message, saving: false, prProgress: null, loading: false };
    case "SET_VALIDATION_ERRORS":
      return { ...state, validationErrors: action.errors, saving: false };
    case "SET_SAVE_SUCCESS":
      return { ...state, saveSuccess: action.value, saving: false, prProgress: null };
    case "UPDATE_SHA":
      return { ...state, sha: action.sha, isNew: false };
    case "SET_PR_PROGRESS":
      return { ...state, prProgress: action.step };
    case "SET_PR_RESULT":
      return { ...state, prResult: action.result, prProgress: null, saving: false };
    case "SET_FORK_BRANCH":
      return { ...state, forkOwner: action.forkOwner, branchName: action.branchName };
    case "SET_DIRTY":
      return { ...state, isDirty: action.value };
    default:
      return state;
  }
}

// --- Pure utilities ---

export function buildAndValidate(state: EditorState): { data: Tutorial } | { errors: string[] } {
  if (state.isNew && !ID_PATTERN.test(state.id)) {
    return { errors: ["ID must be kebab-case (lowercase letters, numbers, hyphens)"] };
  }

  const tutorial = {
    id: state.id,
    title: state.title,
    manufacturer: state.manufacturer,
    model: state.model,
    description: state.description,
    tools: state.tools.filter((t) => t.trim() !== ""),
    steps: state.steps.map((step) => ({
      title: step.title,
      intro: step.intro || undefined,
      substeps: step.substeps.filter((ss) => ss.text.trim() !== ""),
      photos: step.photos.map((photo) => ({
        filename: photo.filename,
        alt: photo.alt,
        annotations: photo.annotations,
      })),
    })),
  };

  const result = TutorialSchema.safeParse(tutorial);
  if (!result.success) {
    return {
      errors: result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }

  return { data: result.data };
}

export function collectPendingImages(steps: StepFormState[]): PendingImage[] {
  const pending: PendingImage[] = [];
  for (const step of steps) {
    for (const photo of step.photos) {
      if (photo.pendingBlob) {
        pending.push({ filename: photo.filename, blob: photo.pendingBlob });
      }
    }
  }
  return pending;
}
