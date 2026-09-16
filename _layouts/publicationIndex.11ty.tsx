import { MainTemplate } from "@components/MainTemplate";
import { PublicationLink } from "@components/PublicationLink";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import IaFile from "../lib/types/IaFile";
import Publication from "../lib/types/Publication";
import { issuesForPublication } from "../lib/publications";

type ViewProps = {
  title: string;
  publications: Record<string, Publication>;
  ia: Record<string, IaFile>;
  page: Page;
  collections: { all: PageMetadata[] };
};

export function publicationIndex({
  title,
  publications,
  ia,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  // Publications with no archived issues have nothing to show yet
  const published = Object.values(publications).filter(
    (publication) => issuesForPublication(ia, publication.id).length > 0,
  );

  return (
    <MainTemplate title={title} page={page} allPages={allPages}>
      <div id="content">
        <h2>Publications</h2>
        <p>
          Journals and periodicals written for camera repair technicians,
          archived issue by issue.
        </p>
      </div>

      {published.length === 0 ? (
        <p>No publications have been archived yet. Check back soon!</p>
      ) : (
        <div class="files">
          <div class="fileList">
            {published.map((publication) => (
              <PublicationLink publication={publication} ia={ia} />
            ))}
          </div>
        </div>
      )}
    </MainTemplate>
  );
}

export const render = publicationIndex;
