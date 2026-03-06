import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../../lib/types/PageMetadata";
import {
  Annotation,
  ArrowAnnotation,
  CircleAnnotation,
  ProcessedPhoto,
  ProcessedStep,
  ProcessedTutorial,
} from "../../lib/types/tutorial";

type ViewProps = {
  tutorial: ProcessedTutorial;
  page: Page;
  collections: { all: PageMetadata[] };
};

export const data = {
  pagination: {
    data: "tutorials",
    size: 1,
    alias: "tutorial",
  },
  eleventyComputed: {
    permalink: ({ tutorial }: { tutorial: ProcessedTutorial }) =>
      `/tutorials/${tutorial.id}/`,
    title: ({ tutorial }: { tutorial: ProcessedTutorial }) => tutorial.title,
  },
};

const STROKE_WIDTH_RATIO = 0.004;
const ANNOTATION_COLOURS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00"];
const ANNOTATION_COLOUR_UNLINKED = "#999999";

function substepColour(index: number): string {
  return ANNOTATION_COLOURS[index % ANNOTATION_COLOURS.length];
}

function annotationColour(annotation: Annotation): string {
  if (annotation.substep === undefined) return ANNOTATION_COLOUR_UNLINKED;
  return substepColour(annotation.substep);
}

function renderCircle(
  annotation: CircleAnnotation,
  w: number,
  h: number
): JSX.Element {
  const { cx, cy, r } = annotation;
  const colour = annotationColour(annotation);
  return (
    <circle
      cx={cx * w}
      cy={cy * h}
      r={r * w}
      stroke={colour}
      stroke-width={STROKE_WIDTH_RATIO * w}
      fill="none"
    />
  );
}

function renderArrow(
  annotation: ArrowAnnotation,
  w: number,
  h: number
): JSX.Element {
  const { x1, y1, x2, y2 } = annotation;
  const colour = annotationColour(annotation);
  return (
    <line
      x1={x1 * w}
      y1={y1 * h}
      x2={x2 * w}
      y2={y2 * h}
      stroke={colour}
      stroke-width={STROKE_WIDTH_RATIO * w}
      marker-end="url(#arrowhead)"
    />
  );
}

function renderAnnotation(annotation: Annotation, w: number, h: number): JSX.Element {
  if (annotation.type === "circle") return renderCircle(annotation, w, h);
  return renderArrow(annotation, w, h);
}

function renderPhotoFigure(photo: ProcessedPhoto): JSX.Element {
  const largest = photo.image.jpeg[photo.image.jpeg.length - 1];
  const { width: w, height: h } = largest;
  return (
    <figure class="tutorial-photo">
      <div class="photo-wrapper">
        <picture>
          <source
            type="image/webp"
            srcset={photo.image.webp.map((img) => img.srcset).join(", ")}
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <img src={largest.url} alt={photo.alt} width={w} height={h} />
        </picture>
        {photo.annotations.length > 0 ? (
          <svg
            class="annotations"
            viewBox={`0 0 ${w} ${h}`}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
              </marker>
            </defs>
            {photo.annotations.map((ann) => renderAnnotation(ann, w, h))}
          </svg>
        ) : undefined}
      </div>
      {photo.alt ? <figcaption>{photo.alt}</figcaption> : undefined}
    </figure>
  );
}

function renderThumbs(photos: ProcessedPhoto[]): JSX.Element {
  return (
    <div class="gallery-thumbs" role="list">
      {photos.map((photo, i) => {
        const thumb = photo.image.webp[0];
        return (
          <button
            class={`gallery-thumb${i === 0 ? " is-active" : ""}`}
            data-gallery-thumb={String(i)}
            aria-pressed={String(i === 0)}
            aria-label={`Photo ${i + 1}`}
            role="listitem"
          >
            <img src={thumb.url} alt={photo.alt} width={thumb.width} height={thumb.height} />
          </button>
        );
      })}
    </div>
  );
}

function renderStepContent(step: ProcessedStep): JSX.Element {
  const hasGallery = step.photos.length > 1;
  return (
    <div class="step-content">
      {hasGallery ? renderThumbs(step.photos) : undefined}
      {step.intro ? <p class="step-intro">{step.intro}</p> : undefined}
      {step.substeps.length > 0 ? (
        <ol class="step-substeps">
          {step.substeps.map((substep, i) => (
            <li style={`--substep-colour: ${substepColour(i)}`}>
              {substep.text}
            </li>
          ))}
        </ol>
      ) : undefined}
    </div>
  );
}

function renderStep(step: ProcessedStep): JSX.Element {
  const hasGallery = step.photos.length > 1;

  if (step.photos.length === 0) {
    return (
      <li class="tutorial-step">
        <h3>{step.title}</h3>
        {renderStepContent(step)}
      </li>
    );
  }

  const photoColumn = (
    <div class="step-photo">
      {hasGallery ? (
        <div class="gallery-photos">
          {step.photos.map((photo, i) => (
            <div
              class={`gallery-photo${i === 0 ? " is-active" : ""}`}
              data-gallery-photo={String(i)}
            >
              {renderPhotoFigure(photo)}
            </div>
          ))}
        </div>
      ) : (
        renderPhotoFigure(step.photos[0])
      )}
    </div>
  );

  return (
    <li class="tutorial-step">
      <h3>{step.title}</h3>
      {hasGallery ? (
        <div class="step-body" data-gallery="true">
          {photoColumn}
          {renderStepContent(step)}
        </div>
      ) : (
        <div class="step-body">
          {photoColumn}
          {renderStepContent(step)}
        </div>
      )}
    </li>
  );
}

export function render({
  tutorial,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate
      title={tutorial.title}
      page={page}
      allPages={allPages}
      pageScripts={<script src="/static/js/tutorials.js" defer></script>}
    >
      <h2>{tutorial.title}</h2>
      <p class="tutorial-description">
        {tutorial.manufacturer} {tutorial.model} &mdash; {tutorial.description}
      </p>
      {tutorial.tools.length > 0 ? (
        <div class="tutorial-tools">
          <h3>Tools &amp; Materials</h3>
          <p>You will need the following tools and materials to complete this tutorial:</p>
          <ul>
            {tutorial.tools.map((tool) => (
              <li>{tool}</li>
            ))}
          </ul>
        </div>
      ) : undefined}
      <ol class="tutorial-steps">
        {tutorial.steps.map(renderStep)}
      </ol>
    </MainTemplate>
  );
}
