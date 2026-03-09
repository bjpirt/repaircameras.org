import type { TroubleshootingEntry } from "@shared/types/cameraPage";
import "./TroubleshootingEditor.css";

interface TroubleshootingEditorProps {
  entries: TroubleshootingEntry[];
  onUpdate: (index: number, field: keyof TroubleshootingEntry, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

export default function TroubleshootingEditor({
  entries,
  onUpdate,
  onRemove,
  onAdd,
}: TroubleshootingEditorProps) {
  return (
    <div className="troubleshooting-editor">
      {entries.length > 0 && (
        <table className="troubleshooting-table">
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Cause</th>
              <th>Solution</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i}>
                <td>
                  <textarea
                    value={entry.symptom}
                    onChange={(e) => onUpdate(i, "symptom", e.target.value)}
                    rows={2}
                  />
                </td>
                <td>
                  <textarea
                    value={entry.cause}
                    onChange={(e) => onUpdate(i, "cause", e.target.value)}
                    rows={2}
                  />
                </td>
                <td>
                  <textarea
                    value={entry.solution}
                    onChange={(e) => onUpdate(i, "solution", e.target.value)}
                    rows={2}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => onRemove(i)}
                    title="Remove"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="btn-secondary btn-small" onClick={onAdd}>
        + Add troubleshooting entry
      </button>
    </div>
  );
}
