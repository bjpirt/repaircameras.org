import { useRef, useCallback } from "react";
import type { NewLinkFormState } from "../pages/cameraEditorReducer";
import "./LinkCreator.css";

interface LinkCreatorProps {
  link: NewLinkFormState;
  index: number;
  onUpdate: (index: number, field: "id" | "title" | "url" | "description", value: string) => void;
  onSetThumbnail: (index: number, blob: Blob, preview: string) => void;
  onRemove: (index: number) => void;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function suggestLinkId(url: string, manufacturer?: string, model?: string): string {
  const videoId = extractYouTubeId(url);
  const prefix = [manufacturer, model].filter(Boolean).join("-").toLowerCase().replace(/\s+/g, "-");
  if (videoId) {
    return prefix ? `${prefix}-youtube` : "youtube";
  }
  return prefix ? `${prefix}-link` : "link";
}

export default function LinkCreator({
  link,
  index,
  onUpdate,
  onSetThumbnail,
  onRemove,
}: LinkCreatorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const youTubeId = extractYouTubeId(link.url);

  const handleUrlChange = (url: string) => {
    onUpdate(index, "url", url);
    if (!link.id) {
      onUpdate(index, "id", suggestLinkId(url));
    }
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            const preview = URL.createObjectURL(blob);
            onSetThumbnail(index, blob, preview);
          }
          return;
        }
      }
    },
    [index, onSetThumbnail],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      onSetThumbnail(index, file, preview);
    }
  };

  return (
    <div className="link-creator">
      <div className="link-creator-header">
        <strong>New link {index + 1}</strong>
        <button type="button" className="btn-icon btn-danger" onClick={() => onRemove(index)}>
          ×
        </button>
      </div>

      <div className="link-creator-fields">
        <label>
          URL
          <input
            type="text"
            value={link.url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label>
          ID
          <input
            type="text"
            value={link.id}
            onChange={(e) => onUpdate(index, "id", e.target.value)}
            placeholder="e.g. pentax-mx-youtube"
          />
        </label>

        <label>
          Title
          <input
            type="text"
            value={link.title}
            onChange={(e) => onUpdate(index, "title", e.target.value)}
          />
        </label>

        <label>
          Description
          <textarea
            value={link.description}
            onChange={(e) => onUpdate(index, "description", e.target.value)}
            rows={2}
          />
        </label>

        <div className="link-creator-thumbnail">
          <label>Thumbnail</label>
          {youTubeId && !link.thumbnailPreview && (
            <p className="thumbnail-hint">
              <a
                href={`https://img.youtube.com/vi/${youTubeId}/maxresdefault.jpg`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open YouTube thumbnail
              </a>
              {" "}— then right-click → Copy Image, and paste below
            </p>
          )}

          <div
            className="thumbnail-paste-zone"
            onPaste={handlePaste}
            tabIndex={0}
          >
            {link.thumbnailPreview ? (
              <img src={link.thumbnailPreview} alt="Thumbnail preview" />
            ) : (
              <span>Paste image here or click to upload</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="thumbnail-file-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
