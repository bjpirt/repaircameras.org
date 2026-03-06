import type { Annotation } from "@shared/types/tutorial";

const STROKE_WIDTH_RATIO = 0.004;
export const ANNOTATION_COLOURS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00"];
export const ANNOTATION_COLOUR_UNLINKED = "#999999";

export function annotationColour(annotation: Annotation): string {
  if (annotation.substep === undefined) return ANNOTATION_COLOUR_UNLINKED;
  return ANNOTATION_COLOURS[annotation.substep % ANNOTATION_COLOURS.length];
}

interface Props {
  annotations: Annotation[];
  imageWidth: number;
  imageHeight: number;
  selectedIndex?: number | null;
  onAnnotationClick?: (index: number) => void;
}

export default function AnnotationOverlay({
  annotations,
  imageWidth: w,
  imageHeight: h,
  selectedIndex,
  onAnnotationClick,
}: Props) {
  const strokeWidth = STROKE_WIDTH_RATIO * w;
  const handleSize = strokeWidth * 3;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
        </marker>
      </defs>
      {annotations.map((ann, i) => {
        const colour = annotationColour(ann);
        const isSelected = selectedIndex === i;
        const opacity = isSelected ? 1 : 0.85;
        const cursor = onAnnotationClick ? "pointer" : "default";

        if (ann.type === "circle") {
          const cx = ann.cx * w;
          const cy = ann.cy * h;
          const r = ann.r * w;
          return (
            <g key={i} onClick={() => onAnnotationClick?.(i)} style={{ cursor }}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                stroke={colour}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={opacity}
              />
              {isSelected && (
                <>
                  <rect x={cx - handleSize / 2} y={cy - r - handleSize / 2} width={handleSize} height={handleSize} fill="#fff" stroke="#333" strokeWidth={1} data-handle="n" />
                  <rect x={cx - handleSize / 2} y={cy + r - handleSize / 2} width={handleSize} height={handleSize} fill="#fff" stroke="#333" strokeWidth={1} data-handle="s" />
                  <rect x={cx + r - handleSize / 2} y={cy - handleSize / 2} width={handleSize} height={handleSize} fill="#fff" stroke="#333" strokeWidth={1} data-handle="e" />
                  <rect x={cx - r - handleSize / 2} y={cy - handleSize / 2} width={handleSize} height={handleSize} fill="#fff" stroke="#333" strokeWidth={1} data-handle="w" />
                </>
              )}
            </g>
          );
        }

        // Arrow
        const lx1 = ann.x1 * w;
        const ly1 = ann.y1 * h;
        const lx2 = ann.x2 * w;
        const ly2 = ann.y2 * h;
        return (
          <g key={i} onClick={() => onAnnotationClick?.(i)} style={{ cursor }}>
            <line
              x1={lx1}
              y1={ly1}
              x2={lx2}
              y2={ly2}
              stroke={colour}
              strokeWidth={strokeWidth}
              markerEnd="url(#arrowhead)"
              opacity={opacity}
            />
            {/* Wider invisible hit area for selection */}
            <line
              x1={lx1}
              y1={ly1}
              x2={lx2}
              y2={ly2}
              stroke="transparent"
              strokeWidth={strokeWidth * 5}
            />
            {isSelected && (
              <>
                <rect x={lx1 - handleSize / 2} y={ly1 - handleSize / 2} width={handleSize} height={handleSize} fill="#fff" stroke="#333" strokeWidth={1} data-handle="start" />
                <rect x={lx2 - handleSize / 2} y={ly2 - handleSize / 2} width={handleSize} height={handleSize} fill="#fff" stroke="#333" strokeWidth={1} data-handle="end" />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
