import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import Link from "../lib/types/Link";

type ViewProps = {
  collections: {
    cameras: PageMetadata[];
    manufacturers: PageMetadata[];
    all: PageMetadata[];
  };
  page: Page;
  files: Record<string, File>;
  links: Record<string, Link>;
};

export function index({
  collections,
  page,
  files,
  links,
}: ViewProps): JSX.Element {
  const resourceCount = Object.keys(files).length + Object.keys(links).length;
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
    </MainTemplate>
  );
}

export const render = index;
