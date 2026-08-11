import File from "../lib/types/File";
import Link from "../lib/types/Link";
import IaFile from "../lib/types/IaFile";
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
  ia: Record<string, IaFile>;
  tutorials: ProcessedTutorial[];
  relatedFiles: string[];
  relatedLinks: string[];
  relatedArchives?: string[];
  relatedTutorials?: string[];
  troubleshooting?: TroubleshootingEntry[];
  page: Page;
  collections: {
    all: PageMetadata[];
  };
};

// Locally hosted PDFs and Internet Archive files share one section — where a
// file is hosted isn't something the reader should have to care about.
const filesSection = (
  relatedFiles: string[],
  files: Record<string, File>,
  relatedArchives: string[],
  ia: Record<string, IaFile>,
) => {
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
        {relatedArchives.map((id) => {
          if (ia[id]) {
            return (
              <ResourceLink
                id={id}
                url={ia[id].url}
                file={ia[id]}
                badge="Internet Archive"
                size={ia[id].size}
                newTab={false}
              />
            );
          }
          throw new Error(`Archived file not found: ${id}`);
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
  ia,
  relatedLinks,
  relatedArchives,
  relatedTutorials,
  troubleshooting,
  tutorials,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={title} page={page} allPages={allPages}>
      <div id="content">
        <div class="page-title-row">
          <h2>{`${manufacturer} ${model}`}</h2>
          <a href={`/admin${page.url.replace(/\/$/, "")}`} class="edit-page-link">&#x270E; Edit this page</a>
        </div>
        {content}

        {troubleshooting?.length > 0
          ? troubleshootingSection(troubleshooting)
          : undefined}
      </div>

      {relatedTutorials?.length > 0
        ? tutorialsSection(relatedTutorials, tutorials)
        : undefined}

      {relatedFiles?.length > 0 || relatedArchives?.length > 0
        ? filesSection(
            relatedFiles ?? [],
            files,
            relatedArchives ?? [],
            ia,
          )
        : undefined}

      {relatedLinks?.length > 0 ? linksSection(relatedLinks, links) : undefined}
    </MainTemplate>
  );
}

export const render = item;
