import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnnotationEditor from "./AnnotationEditor";
import type { Annotation } from "@shared/types/tutorial";

// Simplified SVG overlay that exposes annotation data for testing
vi.mock("./AnnotationOverlay", () => ({
  default: ({
    annotations,
    selectedIndex,
    onAnnotationClick,
  }: {
    annotations: Annotation[];
    selectedIndex: number | null;
    onAnnotationClick: (i: number) => void;
  }) => (
    <svg data-testid="annotation-overlay">
      {annotations.map((ann, i) => (
        <g
          key={i}
          data-testid={`annotation-${i}`}
          data-selected={i === selectedIndex}
          onClick={() => onAnnotationClick(i)}
        >
          <rect x="0" y="0" width="10" height="10" />
        </g>
      ))}
    </svg>
  ),
  ANNOTATION_COLOURS: ["#e53935", "#1e88e5", "#43a047", "#fb8c00"],
  ANNOTATION_COLOUR_UNLINKED: "#999999",
}));

// Auto-fire onload for new Image() calls
class MockImage {
  onload: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  set src(_url: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  vi.stubGlobal("Image", MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const IMAGE_URL = "blob:test/image";
const SUBSTEP_LABELS = ["Clean shutter blades", "Lubricate helicoid"];
const CIRCLE: Annotation = { type: "circle", cx: 0.5, cy: 0.5, r: 0.1 };
const ARROW: Annotation = { type: "arrow", x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4 };

function renderEditor({
  annotations = [] as Annotation[],
  substepLabels = SUBSTEP_LABELS,
  onSave = vi.fn(),
  onCancel = vi.fn(),
} = {}) {
  return render(
    <AnnotationEditor
      imageUrl={IMAGE_URL}
      annotations={annotations}
      substepLabels={substepLabels}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
}

describe("AnnotationEditor", () => {
  it("shows loading state before image dimensions are known", () => {
    // Override: onload never fires
    class NeverLoadsImage {
      onload: (() => void) | null = null;
      set src(_: string) {}
    }
    vi.stubGlobal("Image", NeverLoadsImage);
    renderEditor();
    expect(screen.getByText("Loading image...")).toBeInTheDocument();
  });

  it("shows the toolbar and annotation overlay after image loads", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByText("Select")).toBeInTheDocument(),
    );
    expect(screen.getByText("Circle")).toBeInTheDocument();
    expect(screen.getByText("Arrow")).toBeInTheDocument();
    expect(screen.getByTestId("annotation-overlay")).toBeInTheDocument();
  });

  it("Cancel button calls onCancel", async () => {
    const onCancel = vi.fn();
    renderEditor({ onCancel });
    await waitFor(() => expect(screen.getByText("Cancel")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("Done button calls onSave with current annotations", async () => {
    const onSave = vi.fn();
    const annotations: Annotation[] = [CIRCLE];
    renderEditor({ annotations, onSave });
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Done"));
    expect(onSave).toHaveBeenCalledWith([CIRCLE]);
  });

  it("renders existing annotations in the overlay", async () => {
    renderEditor({ annotations: [CIRCLE, ARROW] });
    await waitFor(() =>
      expect(screen.getByTestId("annotation-0")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("annotation-1")).toBeInTheDocument();
  });

  it("selecting an annotation shows the substep selector", async () => {
    renderEditor({ annotations: [CIRCLE] });
    await waitFor(() =>
      expect(screen.getByTestId("annotation-0")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("annotation-0"));
    expect(screen.getByText("Substep:")).toBeInTheDocument();
    expect(screen.getByText("Unlinked")).toBeInTheDocument();
    expect(screen.getByText(/Clean shutter blades/)).toBeInTheDocument();
    expect(screen.getByText(/Lubricate helicoid/)).toBeInTheDocument();
  });

  it("Delete key removes the selected annotation", async () => {
    renderEditor({ annotations: [CIRCLE] });
    await waitFor(() =>
      expect(screen.getByTestId("annotation-0")).toBeInTheDocument(),
    );
    // Select annotation first
    await userEvent.click(screen.getByTestId("annotation-0"));
    fireEvent.keyDown(window, { key: "Delete" });
    await waitFor(() =>
      expect(screen.queryByTestId("annotation-0")).not.toBeInTheDocument(),
    );
  });

  it("Escape key deselects without deleting", async () => {
    renderEditor({ annotations: [CIRCLE] });
    await waitFor(() =>
      expect(screen.getByTestId("annotation-0")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("annotation-0"));
    expect(screen.getByText("Substep:")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByText("Substep:")).not.toBeInTheDocument(),
    );
    // Annotation still exists
    expect(screen.getByTestId("annotation-0")).toBeInTheDocument();
  });

  it("Delete button in toolbar removes the selected annotation", async () => {
    renderEditor({ annotations: [CIRCLE] });
    await waitFor(() =>
      expect(screen.getByTestId("annotation-0")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("annotation-0"));
    await userEvent.click(screen.getByText("Delete"));
    await waitFor(() =>
      expect(screen.queryByTestId("annotation-0")).not.toBeInTheDocument(),
    );
  });
});
