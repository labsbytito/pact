import type { Source } from "./model";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 60;
export const PDF_TEXT_LIMIT = 22000;

export const PDF_UNREADABLE =
  "Pact couldn't open this PDF. If it's a local file, turn on “Allow access to file URLs” for Pact in chrome://extensions, or attach the file with +.";

/** Read a PDF from its address and return the text in the same shape as a web page. */
export async function readPdfSource(url: string, fallbackTitle = ""): Promise<Source> {
  let bytes: Uint8Array;
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new Error("This PDF is larger than 25 MB. Attach an excerpt instead.");
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof Error && /25 MB/.test(error.message)) throw error;
    throw new Error(PDF_UNREADABLE);
  }
  if (bytes.byteLength > MAX_BYTES) throw new Error("This PDF is larger than 25 MB. Attach an excerpt instead.");
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new Error(PDF_UNREADABLE);

  const pdfjs = await import("pdfjs-dist");
  const { default: PdfWorker } = (await import("pdfjs-dist/build/pdf.worker.min.mjs?worker")) as { default: new () => Worker };
  if (!pdfjs.GlobalWorkerOptions.workerPort) pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  const doc = await task.promise;
  try {
    const meta = (await doc.getMetadata().catch(() => null))?.info as { Title?: string } | undefined;
    const pages: string[] = [];
    let used = 0;
    let truncated = doc.numPages > MAX_PAGES;
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      page.cleanup();
      if (!text) continue;
      const block = `[Page ${n}]\n${text}`;
      if (used + block.length > PDF_TEXT_LIMIT) {
        pages.push(block.slice(0, Math.max(0, PDF_TEXT_LIMIT - used)));
        truncated = true;
        break;
      }
      pages.push(block);
      used += block.length + 2;
    }
    const text = pages.join("\n\n").trim();
    if (!text)
      throw new Error("This PDF has no selectable text (it may be a scan). Attach it with + to let Claude read the images.");
    let name = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    try { name = decodeURIComponent(name); } catch { /* keep the raw segment */ }
    return {
      title: (meta?.Title?.trim() || fallbackTitle || name || "PDF document").slice(0, 300),
      url,
      description: `PDF · ${doc.numPages} page${doc.numPages === 1 ? "" : "s"}${truncated ? " · start of document" : ""}`,
      text,
      selection: "",
      capturedAt: new Date().toISOString(),
      captureMode: "page",
      pageTextPartial: truncated,
      transcript: [],
      transcriptStatus: "not-video",
    };
  } finally {
    void task.destroy();
  }
}
