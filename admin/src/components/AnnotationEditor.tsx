import { useState, useRef, useEffect, useCallback } from "react";
import type { Annotation, CircleAnnotation, ArrowAnnotation } from "@shared/types/tutorial";
import AnnotationOverlay, { ANNOTATION_COLOURS, ANNOTATION_COLOUR_UNLINKED } from "./AnnotationOverlay";
import "./AnnotationEditor.css";

type Tool = "select" | "circle" | "arrow";

interface DragState {
  type: "move" | "resize" | "create-circle" | "create-arrow";
  startNx: number;
  startNy: number;
  origAnnotation?: Annotation;
  handleId?: string;
}

interface Props {
  imageUrl: string;
  annotations: Annotation[];
  substepLabels: string[];
  onSave: (annotations: Annotation[]) => void;
  onCancel: () => void;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default function AnnotationEditor({ imageUrl, annotations: initialAnnotations, substepLabels, onSave, onCancel }: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>([...initialAnnotations]);
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  // Keyboard handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null) {
        e.preventDefault();
        setAnnotations((prev) => prev.filter((_, i) => i !== selected));
        setSelected(null);
      }
      if (e.key === "Escape") {
        if (dragState) {
          setDragState(null);
        } else {
          setSelected(null);
          setTool("select");
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, dragState]);

  const clientToNormalized = useCallback((clientX: number, clientY: number): { nx: number; ny: number } => {
    const el = containerRef.current;
    if (!el) return { nx: 0, ny: 0 };
    const rect = el.getBoundingClientRect();
    return {
      nx: clamp((clientX - rect.left) / rect.width, 0, 1),
      ny: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const { nx, ny } = clientToNormalized(e.clientX, e.clientY);

    if (tool === "circle") {
      setDragState({ type: "create-circle", startNx: nx, startNy: ny });
      // Add a preview circle
      const newCircle: CircleAnnotation = { type: "circle", cx: nx, cy: ny, r: 0.001 };
      setAnnotations((prev) => [...prev, newCircle]);
      setSelected(annotations.length);
    } else if (tool === "arrow") {
      setDragState({ type: "create-arrow", startNx: nx, startNy: ny });
      const newArrow: ArrowAnnotation = { type: "arrow", x1: nx, y1: ny, x2: nx, y2: ny };
      setAnnotations((prev) => [...prev, newArrow]);
      setSelected(annotations.length);
    }
  }, [tool, annotations.length, clientToNormalized]);

  const handleAnnotationClick = useCallback((index: number) => {
    if (tool !== "select") return;
    setSelected(index);
  }, [tool]);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool !== "select" || selected === null) return;

    const target = e.target as Element;
    const handleId = target.getAttribute("data-handle");
    const { nx, ny } = clientToNormalized(e.clientX, e.clientY);

    if (handleId) {
      e.stopPropagation();
      setDragState({
        type: "resize",
        startNx: nx,
        startNy: ny,
        origAnnotation: { ...annotations[selected] },
        handleId,
      });
    } else if (target.closest("g")) {
      e.stopPropagation();
      setDragState({
        type: "move",
        startNx: nx,
        startNy: ny,
        origAnnotation: { ...annotations[selected] },
      });
    }
  }, [tool, selected, annotations, clientToNormalized]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState || selected === null) return;
    const { nx, ny } = clientToNormalized(e.clientX, e.clientY);

    setAnnotations((prev) => {
      const updated = [...prev];
      const ann = updated[selected];

      if (dragState.type === "create-circle" && ann.type === "circle") {
        const dx = nx - dragState.startNx;
        const dy = ny - dragState.startNy;
        const r = clamp(Math.sqrt(dx * dx + dy * dy), 0.005, 0.5);
        updated[selected] = { ...ann, r };
      } else if (dragState.type === "create-arrow" && ann.type === "arrow") {
        updated[selected] = { ...ann, x2: nx, y2: ny };
      } else if (dragState.type === "move" && dragState.origAnnotation) {
        const dx = nx - dragState.startNx;
        const dy = ny - dragState.startNy;
        const orig = dragState.origAnnotation;
        if (orig.type === "circle") {
          updated[selected] = {
            ...ann,
            cx: clamp(orig.cx + dx, 0, 1),
            cy: clamp(orig.cy + dy, 0, 1),
          } as CircleAnnotation;
        } else if (orig.type === "arrow") {
          updated[selected] = {
            ...ann,
            x1: clamp(orig.x1 + dx, 0, 1),
            y1: clamp(orig.y1 + dy, 0, 1),
            x2: clamp(orig.x2 + dx, 0, 1),
            y2: clamp(orig.y2 + dy, 0, 1),
          } as ArrowAnnotation;
        }
      } else if (dragState.type === "resize" && dragState.origAnnotation) {
        const orig = dragState.origAnnotation;
        if (orig.type === "circle") {
          const cx = orig.cx;
          const cy = orig.cy;
          const dx = nx - cx;
          const dy = ny - cy;
          const r = clamp(Math.sqrt(dx * dx + dy * dy), 0.005, 0.5);
          updated[selected] = { ...ann, r } as CircleAnnotation;
        } else if (orig.type === "arrow") {
          if (dragState.handleId === "start") {
            updated[selected] = { ...ann, x1: nx, y1: ny } as ArrowAnnotation;
          } else {
            updated[selected] = { ...ann, x2: nx, y2: ny } as ArrowAnnotation;
          }
        }
      }

      return updated;
    });
  }, [dragState, selected, clientToNormalized]);

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    // If a create-circle resulted in a tiny radius (just a click), use default
    if (dragState.type === "create-circle" && selected !== null) {
      setAnnotations((prev) => {
        const ann = prev[selected];
        if (ann.type === "circle" && ann.r < 0.01) {
          const updated = [...prev];
          updated[selected] = { ...ann, r: 0.05 };
          return updated;
        }
        return prev;
      });
      setTool("select");
    }

    // If a create-arrow was too short, remove it
    if (dragState.type === "create-arrow" && selected !== null) {
      setAnnotations((prev) => {
        const ann = prev[selected];
        if (ann.type === "arrow") {
          const dx = ann.x2 - ann.x1;
          const dy = ann.y2 - ann.y1;
          if (Math.sqrt(dx * dx + dy * dy) < 0.02) {
            return prev.filter((_, i) => i !== selected);
          }
        }
        return prev;
      });
      setTool("select");
    }

    setDragState(null);
  }, [dragState, selected]);

  const selectedAnnotation = selected !== null ? annotations[selected] : null;

  const handleSubstepChange = useCallback((value: string) => {
    if (selected === null) return;
    const substep = value === "" ? undefined : parseInt(value, 10);
    setAnnotations((prev) => {
      const updated = [...prev];
      updated[selected] = { ...updated[selected], substep } as Annotation;
      return updated;
    });
  }, [selected]);

  const handleDelete = useCallback(() => {
    if (selected === null) return;
    setAnnotations((prev) => prev.filter((_, i) => i !== selected));
    setSelected(null);
  }, [selected]);

  if (!imageSize) {
    return (
      <div className="annotation-modal">
        <div className="annotation-modal-header">
          <button onClick={onCancel}>Cancel</button>
          <span>Loading image...</span>
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="annotation-modal">
      <div className="annotation-modal-header">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <span>Annotation Editor</span>
        <button onClick={() => onSave(annotations)} className="btn-primary">Done</button>
      </div>

      <div className="annotation-toolbar">
        <button
          className={`tool-button ${tool === "select" ? "active" : ""}`}
          onClick={() => { setTool("select"); }}
        >
          Select
        </button>
        <button
          className={`tool-button ${tool === "circle" ? "active" : ""}`}
          onClick={() => { setTool("circle"); setSelected(null); }}
        >
          Circle
        </button>
        <button
          className={`tool-button ${tool === "arrow" ? "active" : ""}`}
          onClick={() => { setTool("arrow"); setSelected(null); }}
        >
          Arrow
        </button>

        <div className="toolbar-separator" />

        {selectedAnnotation && (
          <>
            <label className="toolbar-label">Substep:</label>
            <select
              value={selectedAnnotation.substep ?? ""}
              onChange={(e) => handleSubstepChange(e.target.value)}
              className="substep-select"
            >
              <option value="">Unlinked</option>
              {substepLabels.map((label, i) => (
                <option key={i} value={i}>
                  {i + 1}. {truncate(label, 40)}
                </option>
              ))}
            </select>
            <span
              className="colour-preview"
              style={{
                backgroundColor: selectedAnnotation.substep !== undefined
                  ? ANNOTATION_COLOURS[selectedAnnotation.substep % ANNOTATION_COLOURS.length]
                  : ANNOTATION_COLOUR_UNLINKED,
              }}
            />
            <button onClick={handleDelete} className="tool-button btn-danger">
              Delete
            </button>
          </>
        )}
      </div>

      <div className="annotation-canvas">
        <div
          ref={containerRef}
          className="annotation-canvas-inner"
          onMouseDown={(e) => {
            // Deselect when clicking empty space in select mode
            if (tool === "select" && !(e.target as Element).closest("g")) {
              setSelected(null);
            }
            handleMouseDown(e);
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={imageUrl}
            alt=""
            style={{ display: "block", maxWidth: "100%", maxHeight: "calc(100vh - 160px)" }}
            draggable={false}
          />
          <div
            onMouseDown={handleOverlayMouseDown}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          >
            <AnnotationOverlay
              annotations={annotations}
              imageWidth={imageSize.w}
              imageHeight={imageSize.h}
              selectedIndex={selected}
              onAnnotationClick={handleAnnotationClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
