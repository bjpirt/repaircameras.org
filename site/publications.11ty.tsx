import { MainTemplate } from "@components/MainTemplate";
import { ResourceLink } from "@components/ResourceLink";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import IaFile from "../lib/types/IaFile";
import Publication from "../lib/types/Publication";
import {
  groupIssuesByYear,
  issueLabel,
  issuesForPublication,
  PublicationIssue,
} from "../lib/publications";

type ViewProps = {
  publication: Publication;
  ia: Record<string, IaFile>;
  page: Page;
  collections: { all: PageMetadata[] };
};

export const data = {
  pagination: {
    data: "publications",
    size: 1,
    alias: "publication",
    resolve: "values",
  },
  eleventyComputed: {
    permalink: ({ publication }: { publication: Publication }) =>
      publication.url,
    title: ({ publication }: { publication: Publication }) => publication.title,
  },
};

const issueLink = (issue: PublicationIssue) => (
  <ResourceLink
    id={issue.id}
    url={issue.url}
    file={{ ...issue, title: issueLabel(issue) }}
    size={issue.size}
    newTab={false}
  />
);

export function publications({
  publication,
  ia,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  const years = groupIssuesByYear(issuesForPublication(ia, publication.id));

  return (
    <MainTemplate title={publication.title} page={page} allPages={allPages}>
      <div id="content">
        <h2>{publication.title}</h2>
        <p>{publication.description}</p>
      </div>

      {years.length === 0 ? (
        <p>No issues have been archived yet. Check back soon!</p>
      ) : (
        years.map((year) => (
          <div class="files publicationYear">
            <h3>{year.year}</h3>
            <div class="fileList">{year.issues.map(issueLink)}</div>
          </div>
        ))
      )}
    </MainTemplate>
  );
}

export const render = publications;
