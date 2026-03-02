import type { StepFormState, EditorAction } from "./TutorialEditor";
import PhotoManager from "../components/PhotoManager";

interface Props {
  step: StepFormState;
  index: number;
  totalSteps: number;
  tutorialId: string;
  token: string;
  dispatch: React.Dispatch<EditorAction>;
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
            <span className="substep-number">{j + 1}.</span>
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
        tutorialId={tutorialId}
        token={token}
        dispatch={dispatch}
      />
    </div>
  );
}
