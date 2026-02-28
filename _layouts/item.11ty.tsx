import File from "../lib/types/File";
import Link from "../lib/types/Link";
import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import { ImageCollection } from "../lib/types/ImageMetadata";
import { ResourceLink } from "@components/ResourceLink";
import { ProcessedTutorial } from "../lib/types/tutorial";

type ViewProps = {
  content: string;
  title: string;
  manufacturer: string;
  model: string;
  files: Record<string, File>;
  links: Record<string, Link>;
  tutorials: ProcessedTutorial[];
  relatedFiles: string[];
  relatedLinks: string[];
  relatedTutorials?: string[];
  page: Page;
  collections: {
    all: PageMetadata[];
  };
};

const filesSection = (relatedFiles: string[], files: Record<string, File>) => {
  return (
    <div class="files">
      <h3>Files</h3>
      <div class="fileList">
        {relatedFiles.map((file) => {
          if (files[file]) {
            const url = `/files/${file}.pdf`;
            return <ResourceLink id={file} url={url} file={files[file]} />;
          }
          throw new Error(`File not found: ${file}`);
        })}
      </div>
    </div>
  );
};

const linksSection = (relatedLinks: string[], links: Record<string, Link>) => {
  return (
    <div class="files">
      <h3>Other Resources</h3>
      <div class="fileList">
        {relatedLinks.map((link) => {
          if (links[link]) {
            return (
              <ResourceLink
                id={link}
                url={links[link].url}
                file={links[link]}
              />
            );
          }
          throw new Error(`File not found: ${link}`);
        })}
      </div>
    </div>
  );
};

const tutorialsSection = (
  relatedTutorials: string[],
  tutorials: ProcessedTutorial[]
) => {
  return (
    <div class="files">
      <h3>Tutorials</h3>
      <ul class="tutorial-list tutorial-list--inline">
        {relatedTutorials.map((id) => {
          const tutorial = tutorials.find((t) => t.id === id);
          if (!tutorial) throw new Error(`Tutorial not found: ${id}`);
          return (
            <li class="tutorial-card">
              <a href={`/tutorials/${tutorial.id}/`}>
                <strong>{tutorial.title}</strong>
              </a>
              <p>{tutorial.description}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export function item({
  content,
  title,
  manufacturer,
  model,
  relatedFiles,
  files,
  links,
  relatedLinks,
  relatedTutorials,
  tutorials,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={title} page={page} allPages={allPages}>
      <h2>{`${manufacturer} ${model}`}</h2>
      {content}

      {relatedFiles?.length > 0 ? filesSection(relatedFiles, files) : undefined}

      {relatedLinks?.length > 0 ? linksSection(relatedLinks, links) : undefined}

      {relatedTutorials?.length > 0
        ? tutorialsSection(relatedTutorials, tutorials)
        : undefined}
    </MainTemplate>
  );
}

export const render = item;
