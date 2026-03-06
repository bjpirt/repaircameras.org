export interface ResizedImage {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

export function calculateResizeDimensions(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number,
): { width: number; height: number } {
  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight };
  }
  const scale = maxDimension / Math.max(srcWidth, srcHeight);
  return {
    width: Math.round(srcWidth * scale),
    height: Math.round(srcHeight * scale),
  };
}

function sanitiseFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  const sanitised = base.toLowerCase().replace(/\s+/g, "-");
  return `${sanitised}.jpg`;
}

export async function resizeImage(
  file: File,
  maxDimension: number = 2000,
  quality: number = 0.85,
): Promise<ResizedImage> {
  const url = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image"));
      el.src = url;
    });

    const { width, height } = calculateResizeDimensions(
      img.naturalWidth,
      img.naturalHeight,
      maxDimension,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });

    return {
      blob,
      filename: sanitiseFilename(file.name),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
