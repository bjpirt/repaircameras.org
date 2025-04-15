type ImageMetadata = {
  format: "jpeg" | "webp";
  width: number;
  height: number;
  url: string;
  sourceType: string;
  srcset: string;
  filename: string;
  outputPath: string;
  size: number;
};

export type ImageCollection = {
  webp: ImageMetadata[];
  jpeg: ImageMetadata[];
};

export default ImageMetadata;
