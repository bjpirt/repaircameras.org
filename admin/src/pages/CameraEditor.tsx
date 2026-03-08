import { useEffect, useReducer, useCallback, useState, useRef } from "react";
import { useParams, Link, useBlocker } from "react-router";
import { createPullRequest, type PullRequestResult } from "../services/github";
import { saveCameraToForkBranch, type NewLinkEntry } from "../services/github-camera";
import { config } from "../config";
import {
  cameraEditorReducer,
  createInitialState,
  buildAndValidate,
} from "./cameraEditorReducer";
import { useCameraLoader } from "./useCameraLoader";
import PdfPicker from "../components/PdfPicker";
import TroubleshootingEditor from "../components/TroubleshootingEditor";
import LinkCreator from "../components/LinkCreator";
import EditorMessages from "../components/EditorMessages";
import "./CameraEditor.css";

interface Props {
  token: string;
  username: string;
}

export default function CameraEditor({ token, username }: Props) {
  const { manufacturer: paramMfg, model: paramModel } = useParams<{
    manufacturer: string;
    model: string;
  }>();
  const isNew = !paramMfg || !paramModel;
  const [state, dispatch] = useReducer(
    cameraEditorReducer,
    createInitialState(paramMfg ?? "", paramModel ?? "", isNew),
  );

  useCameraLoader(token, username, state.manufacturerSlug, state.modelSlug, isNew, dispatch);

  // Existing link picker
  const [linkPickerQuery, setLinkPickerQuery] = useState("");
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const linkPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (linkPickerRef.current && !linkPickerRef.current.contains(e.target as Node)) {
        setLinkPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredExistingLinks = linkPickerQuery
    ? state.availableLinks
        .filter((l) => !state.relatedLinks.includes(l))
        .filter((l) => l.toLowerCase().includes(linkPickerQuery.toLowerCase()))
        .slice(0, 20)
    : [];

  // Warn on navigation
  useEffect(() => {
    if (!state.isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isDirty]);

  const blocker = useBlocker(state.isDirty);

  const handleSave = useCallback(async () => {
    const result = buildAndValidate(state);
    if ("errors" in result) {
      dispatch({ type: "SET_VALIDATION_ERRORS", errors: result.errors });
      return;
    }

    dispatch({ type: "SET_SAVING", saving: true });

    try {
      const branchPrefix = state.isNew ? "camera/new" : "camera/edit";
      const newBranchName = `${branchPrefix}/${state.manufacturerSlug}/${state.modelSlug}`;

      // Collect new links with thumbnails
      const newLinks: NewLinkEntry[] = state.newLinks
        .filter((l) => l.thumbnailBlob && l.id && l.url && l.title)
        .map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          description: l.description,
          thumbnailBlob: l.thumbnailBlob!,
        }));

      const saved = await saveCameraToForkBranch(
        token,
        username,
        state.forkOwner,
        state.branchName,
        newBranchName,
        state.manufacturerSlug,
        state.modelSlug,
        result.data,
        newLinks,
        state.existingManufacturers,
        (step) => dispatch({ type: "SET_PR_PROGRESS", message: step }),
      );

      dispatch({ type: "SET_FORK_BRANCH", forkOwner: saved.forkOwner, branchName: saved.branchName });
      dispatch({ type: "SET_SAVE_SUCCESS" });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to save",
      });
    }
  }, [state, token, username]);

  const handleSubmitPR = useCallback(async () => {
    if (!state.branchName || !state.forkOwner) return;

    dispatch({ type: "SET_SAVING", saving: true });
    dispatch({ type: "SET_PR_PROGRESS", message: "Opening pull request..." });

    try {
      const prTitle = state.isNew
        ? `Add camera: ${state.manufacturer} ${state.model}`
        : `Update camera: ${state.manufacturer} ${state.model}`;
      const prBody = state.isNew
        ? `Adds a new camera page for the ${state.manufacturer} ${state.model}.\n\nSubmitted via the admin editor by @${username}.`
        : `Updates the ${state.manufacturer} ${state.model} camera page.\n\nSubmitted via the admin editor by @${username}.`;

      const pr: PullRequestResult = await createPullRequest(
        token,
        prTitle,
        prBody,
        `${state.forkOwner}:${state.branchName}`,
        config.repoBranch,
      );
      dispatch({ type: "SET_PR_RESULT", result: { number: pr.number, html_url: pr.html_url } });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to create PR",
      });
    }
  }, [state.isNew, state.branchName, state.forkOwner, state.manufacturer, state.model, token, username]);

  if (state.loading) {
    return <div className="loading">Loading camera...</div>;
  }

  if (state.error && !state.manufacturer) {
    return (
      <div className="error-screen">
        <p>{state.error}</p>
        <Link to="/cameras">Back to list</Link>
      </div>
    );
  }

  return (
    <div className="camera-editor">
      <div className="editor-header">
        <Link to="/cameras" className="back-link">Back to list</Link>
        <h2>{isNew ? "New Camera Page" : "Edit Camera Page"}</h2>
        <div className="editor-header-actions">
          <button onClick={handleSave} disabled={state.saving} className="btn-primary">
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
        {state.branchName && <span className="status-branch">Branch: <a href={`https://github.com/${state.forkOwner}/${config.repoName}/tree/${state.branchName}`} target="_blank" rel="noopener noreferrer">{state.branchName}</a></span>}
        {state.isDirty ? (
          <span className="status-dirty">Unsaved changes</span>
        ) : state.branchName ? (
          <span className="status-clean">All changes saved</span>
        ) : null}
      </div>

      <EditorMessages
        error={state.error}
        validationErrors={state.validationErrors}
        saveSuccess={state.saveSuccess}
        prResult={state.prResult}
        prProgress={state.prProgress}
        onClearSaveSuccess={() => dispatch({ type: "CLEAR_SAVE_SUCCESS" })}
      />

      {/* Details */}
      <section className="editor-section">
        <h3>Details</h3>
        <div className="field-group">
          <label>
            Manufacturer
            <input
              type="text"
              value={state.manufacturer}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "manufacturer", value: e.target.value })}
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={state.model}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "model", value: e.target.value })}
            />
          </label>
        </div>
        {isNew && (
          <div className="field-group">
            <label>
              Manufacturer slug (directory name)
              <input
                type="text"
                value={state.manufacturerSlug}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "manufacturerSlug", value: e.target.value })}
                placeholder="e.g. pentax"
              />
            </label>
            <label>
              Model slug (file name)
              <input
                type="text"
                value={state.modelSlug}
                onChange={(e) => dispatch({ type: "SET_FIELD", field: "modelSlug", value: e.target.value })}
                placeholder="e.g. mx"
              />
            </label>
            <div className="slug-preview">
              File path: site/cameras/{state.manufacturerSlug || "..."}/{state.modelSlug || "..."}.md
            </div>
          </div>
        )}
      </section>

      {/* Description */}
      <section className="editor-section">
        <h3>Description</h3>
        <textarea
          className="camera-body-input"
          value={state.body}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "body", value: e.target.value })}
          rows={8}
          placeholder="Camera description (markdown)..."
        />
      </section>

      {/* Related Files */}
      <section className="editor-section">
        <h3>Related Files (PDFs)</h3>
        <PdfPicker
          availablePdfs={state.availablePdfs}
          selectedPdfs={state.relatedFiles}
          onAdd={(fileId) => dispatch({ type: "ADD_RELATED_FILE", fileId })}
          onRemove={(fileId) => dispatch({ type: "REMOVE_RELATED_FILE", fileId })}
        />
      </section>

      {/* Related Links */}
      <section className="editor-section">
        <h3>Related Links</h3>
        {/* Existing links chips */}
        <div className="link-chips">
          {state.relatedLinks.map((linkId) => (
            <span key={linkId} className="pdf-chip">
              {linkId}
              <button
                type="button"
                className="pdf-chip-remove"
                onClick={() => dispatch({ type: "REMOVE_RELATED_LINK", linkId })}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* Existing link picker */}
        {state.availableLinks.length > 0 && (
          <div className="link-picker" ref={linkPickerRef}>
            <input
              type="text"
              placeholder="Search existing links..."
              value={linkPickerQuery}
              onChange={(e) => {
                setLinkPickerQuery(e.target.value);
                setLinkPickerOpen(true);
              }}
              onFocus={() => setLinkPickerOpen(true)}
            />
            {linkPickerOpen && filteredExistingLinks.length > 0 && (
              <ul className="pdf-picker-dropdown">
                {filteredExistingLinks.map((linkId) => (
                  <li key={linkId}>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: "ADD_RELATED_LINK", linkId });
                        setLinkPickerQuery("");
                        setLinkPickerOpen(false);
                      }}
                    >
                      {linkId}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* New links */}
        {state.newLinks.map((link, i) => (
          <LinkCreator
            key={i}
            link={link}
            index={i}
            onUpdate={(idx, field, value) => dispatch({ type: "UPDATE_NEW_LINK", index: idx, field, value })}
            onSetThumbnail={(idx, blob, preview) => dispatch({ type: "SET_NEW_LINK_THUMBNAIL", index: idx, blob, preview })}
            onRemove={(idx) => dispatch({ type: "REMOVE_NEW_LINK", index: idx })}
          />
        ))}
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => dispatch({ type: "ADD_NEW_LINK" })}
        >
          + Create new link
        </button>
      </section>

      {/* Troubleshooting */}
      <section className="editor-section">
        <h3>Troubleshooting</h3>
        <TroubleshootingEditor
          entries={state.troubleshooting}
          onUpdate={(index, field, value) => dispatch({ type: "UPDATE_TROUBLESHOOTING", index, field, value })}
          onRemove={(index) => dispatch({ type: "REMOVE_TROUBLESHOOTING", index })}
          onAdd={() => dispatch({ type: "ADD_TROUBLESHOOTING" })}
        />
      </section>

      {/* Navigation blocker */}
      {blocker.state === "blocked" && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p>You have unsaved changes. Leave anyway?</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => blocker.reset()}>Stay</button>
              <button className="btn-danger" onClick={() => blocker.proceed()}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
