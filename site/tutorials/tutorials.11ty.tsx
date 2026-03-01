import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../../lib/types/PageMetadata";
import {
  Annotation,
  ArrowAnnotation,
  CircleAnnotation,
  ProcessedPhoto,
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

const STROKE_WIDTH = "0.004";
const FONT_SIZE = "0.05";
const COLOUR = "#ff3333";

function renderCircle({ cx, cy, r, label }: CircleAnnotation): JSX.Element {
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={COLOUR}
        stroke-width={STROKE_WIDTH}
        fill="none"
      />
      {label ? (
        <text
          x={cx}
          y={cy - r - 0.015}
          fill={COLOUR}
          font-size={FONT_SIZE}
          text-anchor="middle"
          font-weight="bold"
        >
          {label}
        </text>
      ) : undefined}
    </g>
  );
}

function renderArrow({
  x1,
  y1,
  x2,
  y2,
  label,
}: ArrowAnnotation): JSX.Element {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={COLOUR}
        stroke-width={STROKE_WIDTH}
        marker-end="url(#arrowhead)"
      />
      {label ? (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2 - 0.02}
          fill={COLOUR}
          font-size={FONT_SIZE}
          text-anchor="middle"
          font-weight="bold"
        >
          {label}
        </text>
      ) : undefined}
    </g>
  );
}

function renderAnnotation(annotation: Annotation): JSX.Element {
  if (annotation.type === "circle") return renderCircle(annotation);
  return renderArrow(annotation);
}

function renderPhoto(photo: ProcessedPhoto): JSX.Element {
  const largest = photo.image.jpeg[photo.image.jpeg.length - 1];
  return (
    <figure class="tutorial-photo">
      <div class="photo-wrapper">
        <picture>
          {photo.image.webp.map((img) => (
            <source type="image/webp" srcset={img.srcset} />
          ))}
          <img
            src={largest.url}
            alt={photo.alt}
            width={largest.width}
            height={largest.height}
          />
        </picture>
        {photo.annotations.length > 0 ? (
          <svg
            class="annotations"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
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
                <polygon points="0 0, 10 3.5, 0 7" fill={COLOUR} />
              </marker>
            </defs>
            {photo.annotations.map(renderAnnotation)}
          </svg>
        ) : undefined}
      </div>
      {photo.alt ? <figcaption>{photo.alt}</figcaption> : undefined}
    </figure>
  );
}

export function render({
  tutorial,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={tutorial.title} page={page} allPages={allPages}>
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
        {tutorial.steps.map((step) => (
          <li class="tutorial-step">
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {step.photos.map(renderPhoto)}
          </li>
        ))}
      </ol>
    </MainTemplate>
  );
}
