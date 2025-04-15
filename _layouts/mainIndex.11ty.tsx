import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";

type ViewProps = {
  content: string;
  collections: {
    cameras: PageMetadata[];
    manufacturers: PageMetadata[];
    all: PageMetadata[];
  };
  page: Page;
};

export function index({ content, collections, page }: ViewProps): JSX.Element {
  return (
    <MainTemplate title={""} page={page} allPages={collections.all}>
      {content}
      <h3>Camera Manufacturers</h3>
      <ul>
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
