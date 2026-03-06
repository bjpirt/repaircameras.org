import { useState, useRef, useCallback } from "react";
import type { Annotation } from "@shared/types/tutorial";
import type { PhotoFormState, EditorAction } from "../pages/editorReducer";
import { resizeImage } from "../services/imageResize";
import AnnotationEditor from "./AnnotationEditor";
import "./PhotoManager.css";

interface Props {
  stepIndex: number;
  photos: PhotoFormState[];
  substepLabels: string[];
  substepColours: string[];
  tutorialId: string;
  token: string;
  dispatch: React.Dispatch<EditorAction>;
}

interface UploadingFile {
  filename: string;
  status: "resizing" | "uploading" | "error";
  error?: string;
}

export default function PhotoManager({ stepIndex, photos, substepLabels, substepColours, tutorialId, token, dispatch }: Props) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editingAnnotations, setEditingAnnotations] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;

      const tempName = file.name;
      setUploading((prev) => [...prev, { filename: tempName, status: "resizing" }]);

      try {
        const resized = await resizeImage(file);

        // Store blob locally, upload at save time
        const blobUrl = URL.createObjectURL(resized.blob);

        dispatch({
          type: "ADD_PHOTO",
          stepIndex,
          photo: {
            filename: resized.filename,
            alt: "",
            annotations: [],
            imageUrl: blobUrl,
            pendingBlob: resized.blob,
          },
        });

        setUploading((prev) => prev.filter((u) => u.filename === tempName || u.filename === resized.filename ? false : true));
      } catch (err) {
        setUploading((prev) =>
          prev.map((u) =>
            u.filename === tempName
              ? { ...u, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
              : u,
          ),
        );
      }
    }
  }, [stepIndex, dispatch]);

  const handleRemovePhoto = useCallback((photoIndex: number) => {
    const photo = photos[photoIndex];
    // Revoke blob URL if it's a local preview
    if (photo.pendingBlob && photo.imageUrl) {
      URL.revokeObjectURL(photo.imageUrl);
    }
    dispatch({ type: "REMOVE_PHOTO", stepIndex, photoIndex });
  }, [photos, stepIndex, dispatch]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="photo-manager">
      <label>Photos</label>

      {photos.map((photo, j) => (
        <div key={j} className="photo-item">
          {photo.imageUrl ? (
            <img src={photo.imageUrl} alt={photo.alt} />
          ) : (
            <div className="photo-placeholder">{photo.filename}</div>
          )}
          <div className="photo-item-details">
            <span className="photo-filename">{photo.filename}</span>
            <input
              type="text"
              placeholder="Alt text"
              value={photo.alt}
              onChange={(e) =>
                dispatch({ type: "UPDATE_PHOTO_ALT", stepIndex, photoIndex: j, value: e.target.value })
              }
            />
            <div className="photo-item-actions">
              {photo.annotations.length > 0 && (
                <span className="annotation-badge">
                  {photo.annotations.length} annotation{photo.annotations.length !== 1 ? "s" : ""}
                </span>
              )}
              {photo.imageUrl && (
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => setEditingAnnotations(j)}
                >
                  Edit annotations
                </button>
              )}
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => handleRemovePhoto(j)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      {uploading.map((u, i) => (
        <div key={i} className={`photo-uploading ${u.status === "error" ? "photo-upload-error" : ""}`}>
          <span>{u.filename}</span>
          {u.status === "resizing" && <span>Resizing...</span>}
          {u.status === "uploading" && <span>Uploading...</span>}
          {u.status === "error" && <span className="upload-error-msg">{u.error}</span>}
        </div>
      ))}

      <div
        className={`photo-dropzone ${dragOver ? "drag-over" : ""}`}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        Drop images here or click to upload
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {editingAnnotations !== null && photos[editingAnnotations]?.imageUrl && (
        <AnnotationEditor
          imageUrl={photos[editingAnnotations].imageUrl!}
          annotations={photos[editingAnnotations].annotations}
          substepLabels={substepLabels}
          substepColours={substepColours}
          onSave={(annotations: Annotation[]) => {
            dispatch({ type: "SET_PHOTO_ANNOTATIONS", stepIndex, photoIndex: editingAnnotations, annotations });
            setEditingAnnotations(null);
          }}
          onCancel={() => setEditingAnnotations(null)}
        />
      )}
    </div>
  );
}
