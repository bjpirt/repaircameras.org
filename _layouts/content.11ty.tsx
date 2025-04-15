import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";

type ViewProps = {
  content: string;
  title: string;
  collections: {
    cameras: PageMetadata[];
    manufacturers: PageMetadata[];
    all: PageMetadata[];
  };
  page: Page;
};

export function index({
  content,
  collections,
  page,
  title,
}: ViewProps): JSX.Element {
  return (
    <MainTemplate title={""} page={page} allPages={collections.all}>
      <div class="content">
        <h2>{title}</h2>
        {content}
      </div>
    </MainTemplate>
  );
}

export const render = index;
