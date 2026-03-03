import { useEffect, useReducer, useCallback } from "react";
import { useParams, Link, useBlocker } from "react-router";
import {
  saveToForkBranch,
  createPullRequest,
  type PullRequestResult,
} from "../services/github";
import { config } from "../config";
import {
  editorReducer,
  initialState,
  buildAndValidate,
  collectPendingImages,
} from "./editorReducer";
import { useTutorialLoader } from "./useTutorialLoader";
import StepEditor from "./StepEditor";
import "./TutorialEditor.css";

interface Props {
  token: string;
  username: string;
}

export default function TutorialEditor({ token, username }: Props) {
  const { id: paramId } = useParams<{ id: string }>();
  const isNew = paramId === "new";
  const [state, dispatch] = useReducer(editorReducer, initialState(isNew, isNew ? "" : paramId!));

  useTutorialLoader(token, username, paramId, isNew, dispatch);

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

  const handleSave = useCallback(async () => {
    const result = buildAndValidate(state);
    if ("errors" in result) {
      dispatch({ type: "SET_VALIDATION_ERRORS", errors: result.errors });
      return;
    }

    dispatch({ type: "SET_SAVING", value: true });

    try {
      const pending = collectPendingImages(state.steps);
      const branchPrefix = state.isNew ? "tutorial/new" : "tutorial/edit";
      const newBranchName = `${branchPrefix}/${state.id}`;

      const saved = await saveToForkBranch(
        token,
        username,
        state.forkOwner,
        state.branchName,
        newBranchName,
        state.id,
        result.data,
        pending,
        (step) => dispatch({ type: "SET_PR_PROGRESS", step }),
      );

      dispatch({ type: "SET_FORK_BRANCH", forkOwner: saved.forkOwner, branchName: saved.branchName });
      dispatch({ type: "SET_SAVE_SUCCESS", value: true });
      dispatch({ type: "SET_DIRTY", value: false });
      dispatch({ type: "SET_SAVING", value: false });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        message: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [state, token, username]);

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

      const pr: PullRequestResult = await createPullRequest(
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
