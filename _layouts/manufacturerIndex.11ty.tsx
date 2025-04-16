import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";

type ViewProps = {
  content: string;
  manufacturer: string;
  collections: {
    cameras: any;
    all: PageMetadata[];
  };
  page: Page;
};

export function index({
  content,
  manufacturer,
  collections,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={manufacturer} page={page} allPages={allPages}>
      <h3>{manufacturer} Camera Models</h3>
      {content}
      <ul>
        {collections.cameras
          .filter((camera) => camera.data.manufacturer === manufacturer)
          .sort((a, b) => (a.model > b.model ? 1 : b.model > a.model ? -1 : 0))
          .map((camera) => (
            <li>
              <a href={camera.url}>{camera.data.model}</a>
            </li>
          ))}
      </ul>
    </MainTemplate>
  );
}

export const render = index;
