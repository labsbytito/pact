/** Client-side attachment prep for /interpret. No network I/O. */

export type AttachmentKind = "text" | "image";

export type Attachment = {
  id: string;
  name: string;
  mime: string;
  kind: AttachmentKind;
  size: number;
  /** Truncated text for text files. */
  text?: string;
  /** Base64 payload without data-URL prefix (images only). */
  data?: string;
  /** data URL for chip previews (images). */
  previewUrl?: string;
};

export const ATTACHMENT_LIMITS = {
  maxFiles: 3,
  maxTextBytes: 24_000,
  maxImageBytes: 90_000,
  maxImageEdge: 960,
  accept:
    "image/png,image/jpeg,image/webp,image/gif,text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json",
} as const;

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

export function isAllowedAttachment(file: File): boolean {
  if (TEXT_TYPES.has(file.type)) return true;
  if (file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return /\.(txt|md|csv|json|png|jpe?g|webp|gif)$/.test(name);
}

function kindFor(file: File): AttachmentKind {
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name))
    return "image";
  return "text";
}

function mimeFor(file: File): string {
  if (file.type) return file.type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.gif$/i.test(file.name)) return "image/gif";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.json$/i.test(file.name)) return "application/json";
  if (/\.csv$/i.test(file.name)) return "text/csv";
  if (/\.md$/i.test(file.name)) return "text/markdown";
  return "text/plain";
}

async function readTextFile(file: File): Promise<string> {
  const raw = await file.text();
  return raw.slice(0, ATTACHMENT_LIMITS.maxTextBytes);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = url;
  });
}

async function readImageFile(file: File): Promise<{
  data: string;
  mime: string;
  previewUrl: string;
  size: number;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(
      1,
      ATTACHMENT_LIMITS.maxImageEdge / Math.max(image.width, image.height, 1),
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare that image.");
    ctx.drawImage(image, 0, 0, width, height);
    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (
      dataUrl.length > ATTACHMENT_LIMITS.maxImageBytes * 1.37 &&
      quality > 0.45
    ) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > ATTACHMENT_LIMITS.maxImageBytes * 1.37)
      throw new Error(
        "That image is too large after compression. Try a smaller one.",
      );
    const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
    return {
      data,
      mime: "image/jpeg",
      previewUrl: dataUrl,
      size: Math.ceil((data.length * 3) / 4),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Turn a File into a compact attachment ready for /interpret. */
export async function prepareAttachment(file: File): Promise<Attachment> {
  if (!isAllowedAttachment(file))
    throw new Error("Pact accepts images and text files (txt, md, csv, json).");
  const kind = kindFor(file);
  const id = crypto.randomUUID();
  if (kind === "text") {
    const text = await readTextFile(file);
    return {
      id,
      name: file.name.slice(0, 120),
      mime: mimeFor(file),
      kind,
      size: file.size,
      text,
    };
  }
  const image = await readImageFile(file);
  return {
    id,
    name: file.name.slice(0, 120),
    mime: image.mime,
    kind,
    size: image.size,
    data: image.data,
    previewUrl: image.previewUrl,
  };
}

/** Strip preview URLs before sending to the companion. */
export function wireAttachments(list: readonly Attachment[]) {
  return list.map((item) => ({
    name: item.name,
    mime: item.mime,
    kind: item.kind,
    ...(item.text !== undefined ? { text: item.text } : {}),
    ...(item.data !== undefined ? { data: item.data } : {}),
  }));
}
