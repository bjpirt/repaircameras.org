import File from "../lib/types/File";
import Link from "../lib/types/Link";
import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import { ResourceLink } from "@components/ResourceLink";
import { ProcessedTutorial } from "../lib/types/tutorial";

type TroubleshootingEntry = {
  symptom: string;
  cause: string;
  solution: string;
};

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
  troubleshooting?: TroubleshootingEntry[];
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
  tutorials: ProcessedTutorial[],
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

const troubleshootingSection = (entries: TroubleshootingEntry[]) => {
  return (
    <div class="troubleshooting">
      <h3>Troubleshooting</h3>
      <table>
        <thead>
          <tr>
            <th>Symptom</th>
            <th>Cause</th>
            <th>Solution</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr>
              <td class="symptom">{entry.symptom}</td>
              <td class="cause">{entry.cause}</td>
              <td class="solution">{entry.solution}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  troubleshooting,
  tutorials,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={title} page={page} allPages={allPages}>
      <div id="content">
        <h2>{`${manufacturer} ${model}`}</h2>
        {content}

        {troubleshooting?.length > 0
          ? troubleshootingSection(troubleshooting)
          : undefined}
      </div>

      {relatedTutorials?.length > 0
        ? tutorialsSection(relatedTutorials, tutorials)
        : undefined}

      {relatedFiles?.length > 0 ? filesSection(relatedFiles, files) : undefined}

      {relatedLinks?.length > 0 ? linksSection(relatedLinks, links) : undefined}
    </MainTemplate>
  );
}

export const render = item;
