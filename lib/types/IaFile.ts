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
  // Set when the file is an issue of a publication (see lib/publications.ts)
  publication?: string;
  // ISO-ish issue date, "YYYY-MM", used to group issues by year
  date?: string;
  // Label for the issue within its year, e.g. "May-June"
  issue?: string;
  url: string;
  detailsUrl: string;
  downloadUrl: string;
  embedUrl: string;
  thumbnail: ImageCollection;
};

export default IaFile;
