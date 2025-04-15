import PageMetadata, { Page } from "../lib/types/PageMetadata";

type Props = {
  page: any;
  allPages: any[];
};

type Breadcrumb = {
  title: string;
  url: string;
};

const breadcrumbForPage = (page: PageMetadata): Breadcrumb => {
  return {
    title: page.data.title ?? page.data.model ?? page.data.manufacturer,
    url: page.page.url,
  };
};

const findFullPage = (
  url: string,
  allPages: PageMetadata[]
): PageMetadata | undefined => allPages.find((p) => p.page.url === url);

const getParentUrl = (url: string): string => {
  return `${url.split("/").slice(0, -2).join("/")}/`;
};

const getBreadcrumbPages = (
  url: string,
  allPages: PageMetadata[],
  breadcrumbs: Breadcrumb[]
): Breadcrumb[] => {
  const fullPage = findFullPage(url, allPages);
  if (!fullPage) {
    return breadcrumbs;
  }

  breadcrumbs.push(breadcrumbForPage(fullPage));

  if (url === "/") {
    return breadcrumbs;
  }
  const nextUrl = getParentUrl(url);

  getBreadcrumbPages(nextUrl, allPages, breadcrumbs);

  return breadcrumbs;
};

const getBreadcrumbs = (page: Page, allPages: PageMetadata[]): Breadcrumb[] => {
  const breadcrumbs: Breadcrumb[] = getBreadcrumbPages(page.url, allPages, []);

  return breadcrumbs.reverse();
};

const Breadcrumbs = ({ page, allPages }: Props) => {
  const breadcrumbs = getBreadcrumbs(page, allPages);

  return (
    <ul>
      {breadcrumbs.map(({ title, url }) => (
        <li>
          <a href={url}>{title}</a>
        </li>
      ))}
    </ul>
  );
};

export default Breadcrumbs;
