import { ImageCollection } from "./ImageMetadata";

type File = {
  title: string;
  description?: string;
  thumbnail: ImageCollection;
};

export default File;
