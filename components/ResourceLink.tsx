import { ImageCollection } from "../lib/types/ImageMetadata";
import File from "../lib/types/File";
import { formatFileSize } from "../lib/formatSize";

type Props = {
  id: string;
  url: string;
  file: File;
  badge?: string;
  size?: number;
  // PDFs and external resources open in a new tab; on-site pages don't
  newTab?: boolean;
};

const getImageUrl = (
  id: string,
  width: number,
  images: ImageCollection
): string => {
  const image = images.webp.find((i) => i.width === width);
  if (!image) {
    return "/img/default-file-thumbnail.webp";
  }
  return image.url;
};

export function ResourceLink({
  id,
  url,
  file,
  badge,
  size,
  newTab = true,
}: Props) {
  const meta = [badge, size ? `PDF ${formatFileSize(size)}` : undefined].filter(
    Boolean
  );
  const target = newTab ? "_blank" : undefined;

  return (
    <div class="fileLink">
      <div class="thumbnail">
        <a href={url} target={target}>
          <img
            src={getImageUrl(id, 110, file.thumbnail)}
            alt="Document thumbnail"
          />
        </a>
      </div>
      <div class="details">
        <a href={url} target={target}>
          {file.title}
        </a>
        {file.description ? <p>{file.description}</p> : undefined}
        {meta.length > 0 ? <p class="resourceMeta">{meta.join(" · ")}</p> : undefined}
      </div>
    </div>
  );
}
