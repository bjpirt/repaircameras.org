import { ImageCollection } from "./ImageMetadata";

// A file hosted on the Internet Archive rather than in this repo. The metadata
// is snapshotted from the IA record at import time so builds stay offline.
type IaFile = {
  id: string;
  identifier: string;
  file: string;
  title: string;
  description?: string;
  size?: number;
  url: string;
  detailsUrl: string;
  downloadUrl: string;
  embedUrl: string;
  thumbnail: ImageCollection;
};

export default IaFile;
