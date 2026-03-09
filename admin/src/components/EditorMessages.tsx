import { useEffect } from "react";

interface PrResult {
  number: number;
  html_url: string;
}

interface Props {
  error: string | null;
  validationErrors: string[];
  saveSuccess: boolean;
  saveSuccessMessage?: string;
  prResult: PrResult | null;
  prProgress: string | null;
  onClearSaveSuccess: () => void;
}

export default function EditorMessages({
  error,
  validationErrors,
  saveSuccess,
  saveSuccessMessage = "Changes saved to branch.",
  prResult,
  prProgress,
  onClearSaveSuccess,
}: Props) {
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(onClearSaveSuccess, 5000);
    return () => clearTimeout(timer);
  }, [saveSuccess, onClearSaveSuccess]);

  return (
    <>
      {error && <div className="save-error">{error}</div>}

      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <strong>Please fix the following:</strong>
          <ul>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {saveSuccess && <div className="save-success">{saveSuccessMessage}</div>}

      {prResult && (
        <div className="save-success">
          Pull request created:{" "}
          <a href={prResult.html_url} target="_blank" rel="noopener noreferrer">
            #{prResult.number}
          </a>
        </div>
      )}

      {prProgress && <div className="editor-progress">{prProgress}</div>}
    </>
  );
}
