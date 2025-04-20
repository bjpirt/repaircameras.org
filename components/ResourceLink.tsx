import { ImageCollection } from "../lib/types/ImageMetadata";
import File from "../lib/types/File";

type Props = {
  id: string;
  url: string;
  file: File;
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

export function ResourceLink({ id, url, file }: Props) {
  return (
    <div class="fileLink">
      <div class="thumbnail">
        <a href={url} target="_blank">
          <img
            src={getImageUrl(id, 110, file.thumbnail)}
            alt="Document thumbnail"
          />
        </a>
      </div>
      <div class="details">
        <a href={url} target="_blank">
          {file.title}
        </a>
        {file.description ? <p>{file.description}</p> : undefined}
      </div>
    </div>
  );
}
