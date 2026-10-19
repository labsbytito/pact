/** Client-side attachment prep for /interpret. No network I/O beyond local canvas. */

import { encodeImageForModel, IMAGE_PIPELINE, isImageMime } from "./images";

export type AttachmentKind = "text" | "image" | "document";

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
  maxPdfBytes: 900_000,
  maxImageBytes: IMAGE_PIPELINE.maxEncodedBytes,
  maxImageEdge: IMAGE_PIPELINE.maxLongEdge,
  maxInputBytes: IMAGE_PIPELINE.maxInputBytes,
  accept:
    "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,text/tab-separated-values,application/json,.pdf,.txt,.md,.csv,.tsv,.json,.log,.xml,.yaml,.yml",
} as const;

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/xml",
  "text/xml",
  "application/json",
]);

export function isAllowedAttachment(file: File): boolean {
  if (TEXT_TYPES.has(file.type) || file.type === "application/pdf") return true;
  if (isImageMime(file.type)) return true;
  const name = file.name.toLowerCase();
  return /\.(txt|md|csv|tsv|json|log|xml|yaml|yml|pdf|png|jpe?g|webp|gif)$/.test(name);
}

function kindFor(file: File): AttachmentKind {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "document";
  if (
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(file.name)
  )
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
  if (new TextEncoder().encode(raw).length > ATTACHMENT_LIMITS.maxTextBytes)
    throw new Error("Text files must be 24KB or smaller. Split this file before attaching it.");
  if (raw.includes("\0")) throw new Error("That file does not contain readable text.");
  return raw;
}

/** Turn a File into a compact attachment ready for /interpret. */
export async function prepareAttachment(file: File): Promise<Attachment> {
  if (!isAllowedAttachment(file))
    throw new Error("Pact accepts PDF, PNG, JPEG, WebP, GIF and text files (txt, md, csv, tsv, json, log, xml, yaml). Export Word or spreadsheet files to PDF or text first.");
  if (file.size > ATTACHMENT_LIMITS.maxInputBytes)
    throw new Error("That file is larger than 10MB.");
  const kind = kindFor(file);
  const id = crypto.randomUUID();
  if (kind === "document") {
    if (file.size > ATTACHMENT_LIMITS.maxPdfBytes) throw new Error("PDF files must be 900KB or smaller.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("That file is not a valid PDF.");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { id, name: file.name.slice(0, 120), mime: "application/pdf", kind, size: file.size, data: btoa(binary) };
  }
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
  const image = await encodeImageForModel(file);
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

/** Capture the visible tab, downscale, and return an image attachment. */
export async function prepareScreenshotAttachment(): Promise<Attachment> {
  if (typeof chrome === "undefined" || !chrome.tabs?.captureVisibleTab)
    throw new Error("Screenshot needs the Pact extension in Chrome.");
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
  const image = await encodeImageForModel(dataUrl);
  return {
    id: crypto.randomUUID(),
    name: "Page screenshot",
    mime: image.mime,
    kind: "image",
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
