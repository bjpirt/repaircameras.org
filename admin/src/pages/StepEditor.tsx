import { useState } from "react";
import type { StepFormState, EditorAction } from "./editorReducer";
import PhotoManager from "../components/PhotoManager";
import { SUBSTEP_COLOURS } from "@shared/colours";

interface Props {
  step: StepFormState;
  index: number;
  totalSteps: number;
  tutorialId: string;
  token: string;
  dispatch: React.Dispatch<EditorAction>;
}

function ColourPicker({
  colour,
  defaultColour,
  onChange,
}: {
  colour: string | undefined;
  defaultColour: string;
  onChange: (colour: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeColour = colour ?? defaultColour;

  return (
    <span className="colour-picker-wrapper">
      <button
        type="button"
        className="colour-swatch"
        style={{ background: activeColour }}
        onClick={() => setOpen(!open)}
        title="Choose colour"
      />
      {open && (
        <div className="colour-picker-popover">
          {SUBSTEP_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              className={`colour-option${c === activeColour ? " is-active" : ""}`}
              style={{ background: c }}
              onClick={() => {
                onChange(c === defaultColour ? undefined : c);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </span>
  );
}

const CALLOUT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "\u2014" },
  { value: "caution", label: "\u26A0" },
  { value: "note", label: "\u2139" },
  { value: "reminder", label: "\u21BB" },
];

export default function StepEditor({ step, index, totalSteps, tutorialId, token, dispatch }: Props) {
  return (
    <div className="step-card">
      <div className="step-header">
        <span className="step-number">Step {index + 1}</span>
        <div className="step-actions">
          <button
            type="button"
            className="btn-icon"
            disabled={index === 0}
            onClick={() => dispatch({ type: "MOVE_STEP", from: index, to: index - 1 })}
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn-icon"
            disabled={index === totalSteps - 1}
            onClick={() => dispatch({ type: "MOVE_STEP", from: index, to: index + 1 })}
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="btn-icon btn-danger"
            onClick={() => dispatch({ type: "REMOVE_STEP", index })}
            title="Remove step"
          >
            ×
          </button>
        </div>
      </div>

      <div className="field-group">
        <label>Title</label>
        <input
          type="text"
          value={step.title}
          onChange={(e) =>
            dispatch({ type: "SET_STEP_FIELD", stepIndex: index, field: "title", value: e.target.value })
          }
        />
      </div>

      <div className="field-group">
        <label>Introduction</label>
        <textarea
          value={step.intro}
          onChange={(e) =>
            dispatch({ type: "SET_STEP_FIELD", stepIndex: index, field: "intro", value: e.target.value })
          }
          rows={2}
        />
      </div>

      <div className="substep-section">
        <label>Substeps</label>
        {step.substeps.map((ss, j) => (
          <div key={j} className="list-item-row">
            <ColourPicker
              colour={ss.colour}
              defaultColour={SUBSTEP_COLOURS[j % SUBSTEP_COLOURS.length]}
              onChange={(colour) =>
                dispatch({ type: "UPDATE_SUBSTEP_COLOUR", stepIndex: index, substepIndex: j, colour })
              }
            />
            <input
              type="text"
              value={ss.text}
              onChange={(e) =>
                dispatch({ type: "UPDATE_SUBSTEP", stepIndex: index, substepIndex: j, value: e.target.value })
              }
            />
            <select
              className="callout-select"
              value={ss.callout ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_SUBSTEP_CALLOUT",
                  stepIndex: index,
                  substepIndex: j,
                  callout: (e.target.value || undefined) as "caution" | "note" | "reminder" | undefined,
                })
              }
              title="Callout type"
            >
              {CALLOUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-icon btn-danger"
              onClick={() => dispatch({ type: "REMOVE_SUBSTEP", stepIndex: index, substepIndex: j })}
              title="Remove substep"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => dispatch({ type: "ADD_SUBSTEP", stepIndex: index })}
        >
          + Add substep
        </button>
      </div>

      <PhotoManager
        stepIndex={index}
        photos={step.photos}
        substepLabels={step.substeps.map((ss) => ss.text)}
        substepColours={step.substeps.map((ss, j) => ss.colour ?? SUBSTEP_COLOURS[j % SUBSTEP_COLOURS.length])}
        tutorialId={tutorialId}
        token={token}
        dispatch={dispatch}
      />
    </div>
  );
}
