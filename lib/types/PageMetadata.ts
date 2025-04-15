export type Page = {
  url: string;
};

type PageMetadata = {
  page: Page;
  url: string;
  data: {
    manufacturer?: string;
    model?: string;
    title?: string;
  };
};

export default PageMetadata;
