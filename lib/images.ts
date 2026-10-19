/** Image downscale / encode for Anthropic image blocks. Browser-only. */

export const IMAGE_PIPELINE = {
  /** Reject files larger than this before reading. */
  maxInputBytes: 10 * 1024 * 1024,
  /** Long-edge target for screenshots and photos sent to the model. */
  maxLongEdge: 1568,
  /** Soft cap on encoded JPEG byte size after compression. */
  maxEncodedBytes: 380_000,
  acceptMime: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
} as const;

export type EncodedImage = {
  mime: "image/jpeg";
  data: string;
  previewUrl: string;
  size: number;
  width: number;
  height: number;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = url;
  });
}

/** Downscale to maxLongEdge and JPEG-compress under maxEncodedBytes. */
export async function encodeImageForModel(
  source: Blob | HTMLImageElement | string,
  longEdge = IMAGE_PIPELINE.maxLongEdge,
): Promise<EncodedImage> {
  let objectUrl: string | undefined;
  let image: HTMLImageElement;
  if (typeof source === "string") {
    image = await loadImage(source);
  } else if (source instanceof HTMLImageElement) {
    image = source;
  } else {
    if (source.size > IMAGE_PIPELINE.maxInputBytes)
      throw new Error("That image is larger than 10MB.");
    objectUrl = URL.createObjectURL(source);
    try {
      image = await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    }
  }
  const scale = Math.min(
    1,
    longEdge / Math.max(image.width, image.height, 1),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare that image.");
  ctx.drawImage(image, 0, 0, width, height);
  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (
    dataUrl.length > IMAGE_PIPELINE.maxEncodedBytes * 1.37 &&
    quality > 0.4
  ) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > IMAGE_PIPELINE.maxEncodedBytes * 1.37)
    throw new Error(
      "That image is still too large after compression. Try a smaller one.",
    );
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return {
    mime: "image/jpeg",
    data,
    previewUrl: dataUrl,
    size: Math.ceil((data.length * 3) / 4),
    width,
    height,
  };
}

export function isImageMime(mime: string): boolean {
  return (IMAGE_PIPELINE.acceptMime as readonly string[]).includes(mime);
}
