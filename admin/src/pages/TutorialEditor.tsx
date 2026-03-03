import { useEffect, useReducer, useCallback } from "react";
import { useParams, Link, useBlocker } from "react-router";
import { TutorialSchema } from "@shared/types/tutorial";
import type { Annotation } from "@shared/types/tutorial";
import {
  fetchTutorialJson,
  fetchTutorialJsonFromRef,
  listTutorialImages,
  listTutorialImagesFromRef,
  saveToForkBranch,
  createPullRequest,
  getRefSha,
  type TutorialImageEntry,
  type PendingImage,
  type PullRequestResult,
} from "../services/github";
import { config } from "../config";
import StepEditor from "./StepEditor";
import "./TutorialEditor.css";

// --- State types ---

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

interface EditorState {
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

// --- Actions ---

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

// --- Reducer ---

function editorReducer(state: EditorState, action: EditorAction): EditorState {
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
      return { ...state, error: action.message, saving: false, prProgress: null };
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

// --- Component ---

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface Props {
  token: string;
  username: string;
}

function initialState(isNew: boolean, id: string): EditorState {
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

export default function TutorialEditor({ token, username }: Props) {
  const { id: paramId } = useParams<{ id: string }>();
  const isNew = paramId === "new";
  const [state, dispatch] = useReducer(editorReducer, initialState(isNew, isNew ? "" : paramId!));

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;

    async function load() {
      try {
        // Try to detect an existing branch for auto-resume
        const branchesToTry = [`tutorial/edit/${paramId!}`, `tutorial/new/${paramId!}`];
        for (const branch of branchesToTry) {
          try {
            await getRefSha(token, username, branch);
            // Branch exists — load tutorial and images from it
            const [{ tutorial, sha }, images] = await Promise.all([
              fetchTutorialJsonFromRef(token, username, branch, paramId!),
              listTutorialImagesFromRef(token, username, branch, paramId!),
            ]);
            if (!cancelled) {
              dispatch({ type: "LOAD_TUTORIAL", tutorial, images, sha });
              dispatch({ type: "SET_FORK_BRANCH", forkOwner: username, branchName: branch });
            }
            return;
          } catch {
            // Branch doesn't exist, continue
          }
        }

        // Default: load from main repo
        const [{ tutorial, sha }, images] = await Promise.all([
          fetchTutorialJson(token, paramId!),
          listTutorialImages(token, paramId!),
        ]);
        if (!cancelled) {
          dispatch({ type: "LOAD_TUTORIAL", tutorial, images, sha });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "SET_ERROR",
            message: err instanceof Error ? err.message : "Failed to load tutorial",
          });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token, paramId, isNew, username]);

  // Warn on browser navigation with unsaved changes
  useEffect(() => {
    if (!state.isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isDirty]);

  // Block React Router navigation with unsaved changes
  const blocker = useBlocker(state.isDirty);

  const buildAndValidate = useCallback(() => {
    // Validate ID for new tutorials
    if (state.isNew && !ID_PATTERN.test(state.id)) {
      dispatch({
        type: "SET_VALIDATION_ERRORS",
        errors: ["ID must be kebab-case (lowercase letters, numbers, hyphens)"],
      });
      return null;
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
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
      dispatch({ type: "SET_VALIDATION_ERRORS", errors });
      return null;
    }

    return result.data;
  }, [state]);

  const collectPendingImages = useCallback((): PendingImage[] => {
    const pendingImages: PendingImage[] = [];
    for (const step of state.steps) {
      for (const photo of step.photos) {
        if (photo.pendingBlob) {
          pendingImages.push({ filename: photo.filename, blob: photo.pendingBlob });
        }
      }
    }
    return pendingImages;
  }, [state.steps]);

  const handleSave = useCallback(async () => {
    const tutorial = buildAndValidate();
    if (!tutorial) return;

    dispatch({ type: "SET_SAVING", value: true });

    try {
      const pendingImages = collectPendingImages();
      const branchPrefix = state.isNew ? "tutorial/new" : "tutorial/edit";
      const newBranchName = `${branchPrefix}/${state.id}`;

      const result = await saveToForkBranch(
        token,
        username,
        state.forkOwner,
        state.branchName,
        newBranchName,
        state.id,
        tutorial,
        pendingImages,
        (step) => dispatch({ type: "SET_PR_PROGRESS", step }),
      );

      dispatch({ type: "SET_FORK_BRANCH", forkOwner: result.forkOwner, branchName: result.branchName });
      dispatch({ type: "SET_SAVE_SUCCESS", value: true });
      dispatch({ type: "SET_DIRTY", value: false });
      dispatch({ type: "SET_SAVING", value: false });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [state, token, username, buildAndValidate, collectPendingImages]);

  const handleSubmitPR = useCallback(async () => {
    if (!state.branchName || !state.forkOwner) return;

    dispatch({ type: "SET_SAVING", value: true });
    dispatch({ type: "SET_PR_PROGRESS", step: "Opening pull request..." });

    try {
      const prTitle = state.isNew
        ? `Add tutorial: ${state.title}`
        : `Update tutorial: ${state.title}`;
      const prBody = state.isNew
        ? `Adds a new tutorial for the ${state.manufacturer} ${state.model}.\n\nSubmitted via the admin editor by @${username}.`
        : `Updates the ${state.manufacturer} ${state.model} tutorial.\n\nSubmitted via the admin editor by @${username}.`;

      const pr = await createPullRequest(
        token,
        prTitle,
        prBody,
        `${state.forkOwner}:${state.branchName}`,
        config.repoBranch,
      );
      dispatch({ type: "SET_PR_RESULT", result: pr });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        message: err instanceof Error ? err.message : "Failed to create PR",
      });
    }
  }, [state.isNew, state.branchName, state.forkOwner, state.title, state.manufacturer, state.model, token, username]);

  if (state.loading) {
    return <div className="loading">Loading tutorial...</div>;
  }

  if (state.error && !state.title) {
    return (
      <div className="error-screen">
        <p>{state.error}</p>
        <Link to="/tutorials">Back to list</Link>
      </div>
    );
  }

  return (
    <div className="tutorial-editor">
      <div className="editor-header">
        <Link to="/tutorials" className="back-link">Back to list</Link>
        <h2>{state.isNew ? "New Tutorial" : "Edit Tutorial"}</h2>
        <div className="editor-header-actions">
          <button
            onClick={handleSave}
            disabled={state.saving}
            className="btn-primary"
          >
            {state.saving && !state.prResult ? "Saving..." : "Save to branch"}
          </button>
          <button
            onClick={handleSubmitPR}
            disabled={state.saving || !state.branchName || state.isDirty}
            className="btn-primary"
            title={!state.branchName ? "Save to branch first" : state.isDirty ? "Save changes before submitting" : ""}
          >
            Submit as PR
          </button>
        </div>
      </div>

      <div className="editor-status">
        {state.branchName && (
          <span className="status-branch">Branch: {state.branchName}</span>
        )}
        {state.isDirty ? (
          <span className="status-dirty">Unsaved changes</span>
        ) : state.branchName ? (
          <span className="status-clean">All changes saved</span>
        ) : null}
      </div>

      {state.saveSuccess && (
        <div className="save-success">
          Saved to branch successfully.
        </div>
      )}
      {state.prResult && (
        <div className="save-success">
          Pull request created:{" "}
          <a href={state.prResult.html_url} target="_blank" rel="noopener noreferrer">
            #{state.prResult.number}
          </a>
        </div>
      )}
      {state.error && (
        <div className="save-error">{state.error}</div>
      )}
      {state.validationErrors.length > 0 && (
        <div className="validation-errors">
          <strong>Please fix the following:</strong>
          <ul>
            {state.validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      <section className="editor-section">
        <h3>Details</h3>
        {state.isNew && (
          <div className="field-group">
            <label htmlFor="tutorial-id">ID (slug)</label>
            <input
              id="tutorial-id"
              type="text"
              value={state.id}
              onChange={(e) => dispatch({ type: "SET_ID", value: e.target.value })}
              placeholder="e.g. olympus-om1-cla"
            />
          </div>
        )}
        <div className="field-group">
          <label htmlFor="tutorial-title">Title</label>
          <input
            id="tutorial-title"
            type="text"
            value={state.title}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
          />
        </div>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="tutorial-manufacturer">Manufacturer</label>
            <input
              id="tutorial-manufacturer"
              type="text"
              value={state.manufacturer}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "manufacturer", value: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="tutorial-model">Model</label>
            <input
              id="tutorial-model"
              type="text"
              value={state.model}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "model", value: e.target.value })}
            />
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="tutorial-description">Description</label>
          <textarea
            id="tutorial-description"
            value={state.description}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })}
            rows={3}
          />
        </div>
      </section>

      {/* Tools */}
      <section className="editor-section">
        <h3>Tools & Materials</h3>
        {state.tools.map((tool, i) => (
          <div key={i} className="list-item-row">
            <input
              type="text"
              value={tool}
              onChange={(e) => dispatch({ type: "UPDATE_TOOL", index: i, value: e.target.value })}
            />
            <button
              type="button"
              className="btn-icon btn-danger"
              onClick={() => dispatch({ type: "REMOVE_TOOL", index: i })}
              title="Remove tool"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => dispatch({ type: "ADD_TOOL" })}
        >
          + Add tool
        </button>
      </section>

      {/* Steps */}
      <section className="editor-section">
        <h3>Steps</h3>
        {state.steps.map((step, i) => (
          <StepEditor
            key={i}
            step={step}
            index={i}
            totalSteps={state.steps.length}
            tutorialId={state.id}
            token={token}
            dispatch={dispatch}
          />
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => dispatch({ type: "ADD_STEP" })}
        >
          + Add step
        </button>
      </section>

      {state.prProgress && (
        <div className="pr-progress-overlay">
          <div className="pr-progress-modal">
            <div className="pr-progress-spinner" />
            <p>{state.prProgress}</p>
          </div>
        </div>
      )}

      {blocker.state === "blocked" && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <p>You have unsaved changes. Leave anyway?</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => blocker.reset!()}>Stay</button>
              <button className="btn-primary" onClick={() => blocker.proceed!()}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
