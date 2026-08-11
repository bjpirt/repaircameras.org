import { MainTemplate } from "@components/MainTemplate";
import PageMetadata, { Page } from "../lib/types/PageMetadata";
import IaFile from "../lib/types/IaFile";
import { formatFileSize } from "../lib/formatSize";

type ViewProps = {
  iaFile: IaFile;
  page: Page;
  collections: { all: PageMetadata[] };
};

export const data = {
  pagination: {
    data: "ia",
    size: 1,
    alias: "iaFile",
    resolve: "values",
  },
  eleventyComputed: {
    permalink: ({ iaFile }: { iaFile: IaFile }) => iaFile.url,
    title: ({ iaFile }: { iaFile: IaFile }) => iaFile.title,
  },
};

const getThumbnailUrl = (iaFile: IaFile): string => {
  const image = iaFile.thumbnail.webp.find((i) => i.width === 110);
  return image ? image.url : "/img/default-file-thumbnail.webp";
};

// Cameras that reference this file, so a manual page links back into the site
const usedBy = (iaFile: IaFile, allPages: PageMetadata[]): PageMetadata[] =>
  allPages.filter((p) => (p.data.relatedArchives ?? []).includes(iaFile.id));

const readerFacade = (iaFile: IaFile) => {
  return (
    <div class="iaReader">
      <button
        type="button"
        class="iaReader-facade"
        data-ia-embed={iaFile.embedUrl}
        data-ia-title={iaFile.title}
      >
        <img src={getThumbnailUrl(iaFile)} alt={`Cover of ${iaFile.title}`} />
        <span class="iaReader-cta">Read online</span>
      </button>
      <noscript>
        <p>
          <a href={iaFile.detailsUrl} target="_blank" rel="noopener">
            Read this file on the Internet Archive
          </a>
        </p>
      </noscript>
    </div>
  );
};

export function iaFiles({
  iaFile,
  page,
  collections: { all: allPages },
}: ViewProps): JSX.Element {
  const cameras = usedBy(iaFile, allPages);

  return (
    <MainTemplate
      title={iaFile.title}
      page={page}
      allPages={allPages}
      pageScripts={<script src="/static/js/ia-embed.js" defer></script>}
    >
      <div id="content">
        <h2>{iaFile.title}</h2>
        {iaFile.description ? <p>{iaFile.description}</p> : undefined}

        {readerFacade(iaFile)}

        <p class="iaActions">
          <a class="iaDownload" href={iaFile.downloadUrl}>
            Download PDF
            {iaFile.size ? ` (${formatFileSize(iaFile.size)})` : ""}
          </a>
        </p>

        <p class="iaAttribution">
          This file is hosted by the{" "}
          <a href={iaFile.detailsUrl} target="_blank" rel="noopener">
            Internet Archive
          </a>
          .
        </p>

        {cameras.length > 0 ? (
          <div class="iaUsedBy">
            <h3>Cameras using this file</h3>
            <ul>
              {cameras.map((camera) => (
                <li>
                  <a href={camera.page.url}>
                    {camera.data.title ??
                      `${camera.data.manufacturer} ${camera.data.model}`}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : undefined}
      </div>
    </MainTemplate>
  );
}

export const render = iaFiles;
