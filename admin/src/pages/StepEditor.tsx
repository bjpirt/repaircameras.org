import { useState, useEffect, useRef } from "react";
import type { StepFormState, EditorAction } from "./editorReducer";
import PhotoManager from "../components/PhotoManager";
import {
  BULLET_COLOURS,
  CALLOUT_TYPES,
  STYLE_HEX,
  CALLOUT_ICONS,
  bulletStyleHex,
  isCallout,
  type BulletStyle,
} from "@shared/colours";

interface Props {
  step: StepFormState;
  index: number;
  totalSteps: number;
  tutorialId: string;
  token: string;
  dispatch: React.Dispatch<EditorAction>;
}

function SubstepPicker({
  bulletStyle,
  defaultStyle,
  onChange,
}: {
  bulletStyle: BulletStyle | undefined;
  defaultStyle: BulletStyle;
  onChange: (style: BulletStyle | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const active = bulletStyle ?? defaultStyle;
  const hex = STYLE_HEX[active];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <span className="colour-picker-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="colour-swatch"
        style={{ background: hex }}
        onClick={() => setOpen(!open)}
        title="Bullet style"
      >
        {isCallout(active) ? <span className="swatch-icon">{CALLOUT_ICONS[active]}</span> : null}
      </button>
      {open && (
        <div className="colour-picker-popover">
          <div className="picker-row">
            {BULLET_COLOURS.map((name) => (
              <button
                key={name}
                type="button"
                className={`colour-option${active === name ? " is-active" : ""}`}
                style={{ background: STYLE_HEX[name] }}
                onClick={() => {
                  onChange(name === defaultStyle ? undefined : name);
                  setOpen(false);
                }}
                title={name}
              />
            ))}
          </div>
          <div className="picker-divider" />
          <div className="picker-row callout-row">
            {CALLOUT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`callout-option${active === type ? " is-active" : ""}`}
                style={{ color: STYLE_HEX[type] }}
                onClick={() => { onChange(active === type ? undefined : type); setOpen(false); }}
                title={type.charAt(0).toUpperCase() + type.slice(1)}
              >
                {CALLOUT_ICONS[type]}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

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
            <SubstepPicker
              bulletStyle={ss.bulletStyle}
              defaultStyle={BULLET_COLOURS[j % BULLET_COLOURS.length]}
              onChange={(bulletStyle) =>
                dispatch({ type: "UPDATE_SUBSTEP_STYLE", stepIndex: index, substepIndex: j, bulletStyle })
              }
            />
            <input
              type="text"
              value={ss.text}
              onChange={(e) =>
                dispatch({ type: "UPDATE_SUBSTEP", stepIndex: index, substepIndex: j, value: e.target.value })
              }
            />
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
        substepColours={step.substeps.map((ss, j) => bulletStyleHex(ss.bulletStyle, j))}
        tutorialId={tutorialId}
        token={token}
        dispatch={dispatch}
      />
    </div>
  );
}
