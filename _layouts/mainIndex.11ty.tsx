import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import Link from "../lib/types/Link";
import IaFile from "../lib/types/IaFile";
import Publication from "../lib/types/Publication";
import { ResourceLink } from "@components/ResourceLink";
import { coverIssue, issuesForPublication } from "../lib/publications";

type ViewProps = {
  collections: {
    cameras: PageMetadata[];
    manufacturers: PageMetadata[];
    all: PageMetadata[];
  };
  page: Page;
  files: Record<string, File>;
  links: Record<string, Link>;
  ia: Record<string, IaFile>;
  publications: Record<string, Publication>;
};

// A publication is represented by the cover of one of its issues
const publicationLink = (
  publication: Publication,
  ia: Record<string, IaFile>,
) => {
  const cover = coverIssue(
    publication,
    issuesForPublication(ia, publication.id),
  );
  if (!cover) {
    return undefined;
  }

  return (
    <ResourceLink
      id={publication.id}
      url={publication.url}
      file={{
        title: publication.title,
        description: publication.description,
        thumbnail: cover.thumbnail,
      }}
      newTab={false}
    />
  );
};

export function index({
  collections,
  page,
  files,
  links,
  ia,
  publications,
}: ViewProps): JSX.Element {
  const resourceCount =
    Object.keys(files).length +
    Object.keys(links).length +
    Object.keys(ia).length;
  const preMain =
    page.url === "/" ? (
      <div id="banner">
        <h2>Helping to keep cameras alive</h2>
        <h2 class="sub">
          An open archive of {resourceCount} resources for{" "}
          {collections.cameras.length} cameras from{" "}
          {collections.manufacturers.length} manufacturers, and growing...
        </h2>
      </div>
    ) : undefined;

  return (
    <MainTemplate
      title={""}
      page={page}
      allPages={collections.all}
      preMain={preMain}
    >
      <h3>Camera Manufacturers</h3>
      <ul class="linkList">
        {collections.manufacturers.map((man) => (
          <li>
            <a href={man.url}>{man.data.manufacturer}</a>
          </li>
        ))}
      </ul>

      {Object.keys(publications).length > 0 ? (
        <div class="files publications">
          <h3>Publications</h3>
          <div class="fileList">
            {Object.values(publications).map((publication) =>
              publicationLink(publication, ia),
            )}
          </div>
        </div>
      ) : undefined}
    </MainTemplate>
  );
}

export const render = index;
