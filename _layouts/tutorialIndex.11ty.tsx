import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import { ProcessedTutorial } from "../lib/types/tutorial";

type ViewProps = {
  title: string;
  tutorials: ProcessedTutorial[];
  collections: {
    all: PageMetadata[];
  };
  page: Page;
};

export function tutorialIndex({
  title,
  tutorials,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={title} page={page} allPages={allPages}>
      <h2>Tutorials</h2>
      <p>Step-by-step repair tutorials with annotated photos.</p>
      {tutorials.length === 0 ? (
        <p>No tutorials yet. Check back soon!</p>
      ) : (
        <ul class="tutorial-list">
          {tutorials.map((tutorial) => (
            <li class="tutorial-card">
              <a href={`/tutorials/${tutorial.id}/`}>
                <h3>{tutorial.title}</h3>
              </a>
              <p class="tutorial-meta">
                {tutorial.manufacturer} {tutorial.model} &mdash;{" "}
                {tutorial.steps.length} step
                {tutorial.steps.length !== 1 ? "s" : ""}
              </p>
              <p>{tutorial.description}</p>
            </li>
          ))}
        </ul>
      )}
    </MainTemplate>
  );
}

export const render = tutorialIndex;
