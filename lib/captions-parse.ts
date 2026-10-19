import type { CaptionSegment, CaptionTrack, PanelRow, VideoCandidate, DomNode } from "./captions-types";

export function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
export function decodeEntities(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}
export function parseSrvXml(xml: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const pattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const attrs = match[1] ?? "";
    const start = Number(/start="([^"]+)"/.exec(attrs)?.[1] ?? "0");
    const text = clean(decodeEntities(match[2] ?? ""));
    if (!text || !Number.isFinite(start)) continue;
    segments.push({ start, text });
  }
  return segments;
}
export function parseCaptionBody(body: string): CaptionSegment[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("<")) return parseSrvXml(trimmed);
  let data: any;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const events = Array.isArray(data?.events) ? data.events : [];
  const segments: CaptionSegment[] = [];
  for (const event of events) {
    if (!Array.isArray(event?.segs)) continue;
    const text = clean(
      event.segs.map((seg: any) => seg?.utf8 ?? "").join(""),
    );
    if (!text) continue;
    if (event.aAppend && segments.length) {
      const previous = segments[segments.length - 1]!;
      previous.text = clean(`${previous.text} ${text}`);
      continue;
    }
    if (event.tStartMs == null) continue;
    const start = Number(event.tStartMs) / 1000;
    if (!Number.isFinite(start)) continue;
    segments.push({ start, text });
  }
  return segments;
}
export function captionBodyUsable(body: string) {
  return parseCaptionBody(body).length > 0;
}
export function parseTimestamp(value: string) {
  const parts = value.trim().split(":");
  if (!parts.length || parts.some((part) => !/^\d+(\.\d+)?$/.test(part)))
    return NaN;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}
export function parsePanelRows(rows: PanelRow[]): CaptionSegment[] {
  return rows
    .map((row) => ({
      start: parseTimestamp(row.timestamp ?? ""),
      text: clean(row.text ?? ""),
    }))
    .filter((row) => row.text && Number.isFinite(row.start));
}
export function chooseCaptionTrack<T extends CaptionTrack>(
  tracks: T[],
  preferred: string,
): T | undefined {
  const usable = tracks.filter(
    (track) => typeof track.baseUrl === "string" && track.baseUrl,
  );
  const lang = preferred.split("-")[0]?.toLowerCase() ?? "";
  const rank = (track: T) => {
    const code = (track.languageCode ?? "").toLowerCase();
    const asr = track.kind === "asr" ? 1 : 0;
    if (lang && code === lang) return asr;
    if (code === "en") return 2 + asr;
    return 4 + asr;
  };
  return usable.slice().sort((a, b) => rank(a) - rank(b))[0];
}
export function allowedHost(hostname: string) {
  return (
    /(^|\.)youtube\.com$/.test(hostname) ||
    /(^|\.)googlevideo\.com$/.test(hostname)
  );
}
export function timedTextUrl(baseUrl: string, pot?: string) {
  try {
    const endpoint = new URL(baseUrl);
    if (endpoint.protocol !== "https:" || !allowedHost(endpoint.hostname))
      return;
    endpoint.searchParams.set("fmt", "json3");
    if (pot) endpoint.searchParams.set("pot", pot);
    return endpoint.href;
  } catch {
    return;
  }
}
export function trackNeedsPot(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    const exp = url.searchParams.get("exp") ?? "";
    return /(^|,)xpe(,|$)/.test(exp) && !url.searchParams.get("pot");
  } catch {
    return false;
  }
}
export function extractPotUrl(resourceUrl: string, videoId: string) {
  try {
    const url = new URL(resourceUrl);
    if (url.protocol !== "https:" || !allowedHost(url.hostname)) return;
    if (!url.pathname.includes("timedtext")) return;
    if (url.searchParams.get("v") && url.searchParams.get("v") !== videoId)
      return;
    if (!url.searchParams.get("pot")) return;
    return url.href;
  } catch {
    return;
  }
}
export function videoIdFromUrl(href: string): {
  id?: string;
  kind: "watch" | "shorts" | "other";
} {
  try {
    const url = new URL(href);
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return { kind: "other" };
    const watch = url.searchParams.get("v");
    if (watch) return { id: watch, kind: "watch" };
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1])
      return { id: decodeURIComponent(parts[1]), kind: "shorts" };
    return { kind: "other" };
  } catch {
    return { kind: "other" };
  }
}
export function pickPlayingVideo<T extends VideoCandidate>(
  items: T[],
  urlId?: string,
  kind: "watch" | "shorts" | "other" = "other",
): T | undefined {
  const valid = items.filter((item) => {
    if (!item.videoId) return false;
    if (item.reelId && item.reelId !== item.videoId) return false;
    return true;
  });
  const shorts =
    kind === "shorts" || valid.some((item) => item.reelId !== undefined);
  let pool: T[] = [];
  if (shorts) {
    const activePlaying = valid.filter(
      (item) => item.active && item.paused === false,
    );
    if (activePlaying.length) pool = activePlaying;
    else if (urlId && valid.some((item) => item.videoId === urlId))
      pool = valid.filter((item) => item.videoId === urlId);
    else {
      const active = valid.filter((item) => item.active);
      pool = active.length
        ? active
        : valid.filter((item) => item.paused === false);
    }
  } else if (urlId) {
    pool = valid.filter((item) => item.videoId === urlId);
    if (!pool.length) return;
  } else pool = valid;
  if (!pool.length) pool = valid;
  if (!pool.length) return;
  const playing = pool.filter((item) => item.paused === false);
  const ranked = (playing.length ? playing : pool)
    .slice()
    .sort((a, b) => {
      if (!!a.active !== !!b.active) return a.active ? -1 : 1;
      if (!!a.inView !== !!b.inView) return a.inView ? -1 : 1;
      return (b.currentTime ?? 0) - (a.currentTime ?? 0);
    });
  return ranked[0];
}
export function retainNearPlayback(segments: CaptionSegment[], videoTime?: number) {
  let budget = 100000;
  const sorted = [...segments].sort(
    (a, b) =>
      Math.abs(a.start - (videoTime ?? 0)) -
      Math.abs(b.start - (videoTime ?? 0)),
  );
  const retained: CaptionSegment[] = [];
  let partial = false;
  for (const line of sorted) {
    if (retained.length >= 2000 || budget <= 0) {
      partial = true;
      break;
    }
    const text = line.text.slice(0, Math.min(1000, budget));
    if (text.length < line.text.length) partial = true;
    budget -= text.length;
    if (text) retained.push({ start: line.start, text });
  }
  if (retained.length < segments.length) partial = true;
  retained.sort((a, b) => a.start - b.start);
  return { segments: retained, partial };
}
export function assembleTranscript(input: {
  fetchedBody?: string;
  potBody?: string;
  panel?: PanelRow[];
  videoTime?: number;
}) {
  const fromPot = parseCaptionBody(input.potBody ?? "");
  const parsed = fromPot.length
    ? fromPot
    : parseCaptionBody(input.fetchedBody ?? "");
  const segments = parsed.length
    ? parsed
    : parsePanelRows(input.panel ?? []);
  const retained = retainNearPlayback(segments, input.videoTime);
  return {
    transcript: retained.segments,
    transcriptPartial: retained.partial,
    transcriptStatus: retained.segments.length
      ? ("available" as const)
      : ("unavailable" as const),
  };
}
export function nodeText(node: DomNode | null | undefined) {
  return clean(node?.textContent ?? "");
}
export function panelRows(doc: DomNode): PanelRow[] {
  const rows = [
    ...Array.from(
      doc.querySelectorAll?.("ytd-transcript-segment-renderer") ?? [],
    ),
    ...Array.from(
      doc.querySelectorAll?.("transcript-segment-view-model") ?? [],
    ),
  ];
  return rows
    .map((row) => ({
      timestamp: nodeText(
        row.querySelector?.(
          ".segment-timestamp, #segment-timestamp, [class*='timestamp']",
        ),
      ),
      text: nodeText(
        row.querySelector?.(
          ".segment-text, #segment-text, [class*='segment-text']",
        ),
      ),
    }))
    .filter((row) => row.text);
}
