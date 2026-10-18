// Pure caption parsing and the YouTube fallback sequence.
// YouTube often answers /api/timedtext with HTTP 200 and an empty body unless the
// request carries a player-minted pot= token (exp=xpe). response.json() throws on
// that body; callers must read text and fall back.
export type CaptionSegment = { start: number; text: string };
export type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};
export type PanelRow = { timestamp: string; text: string };
export type VideoCandidate = {
  videoId?: string;
  reelId?: string;
  active?: boolean;
  paused?: boolean;
  currentTime?: number;
  inView?: boolean;
};

type Rect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};
type PlayerResponse = {
  videoDetails?: { videoId?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
};
type DomNode = {
  id?: string;
  className?: string;
  classList?: { contains(name: string): boolean };
  textContent?: string | null;
  paused?: boolean;
  currentTime?: number;
  getAttribute?(name: string): string | null;
  hasAttribute?(name: string): boolean;
  getBoundingClientRect?(): Rect;
  querySelector?(selector: string): DomNode | null;
  querySelectorAll?(selector: string): ArrayLike<DomNode>;
  closest?(selector: string): DomNode | null;
  click?(): void;
  getPlayerResponse?(): PlayerResponse | undefined;
  toggleSubtitles?(): void;
  getElementById?(id: string): DomNode | null;
};
export type CaptionEnv = {
  href: string;
  lang: string;
  viewportHeight: number;
  document: DomNode;
  initialPlayerResponse?: PlayerResponse;
  now: () => number;
  wait: (ms: number) => Promise<void>;
  fetch: (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>;
  performance: { getEntriesByType(type: string): { name: string }[] };
  patchNetwork: (onUrl: (url: string) => void) => () => void;
};

export function captionKit() {
  const POT_WAIT_MS = 4000;
  const PANEL_WAIT_MS = 3000;
  const POLL_MS = 200;
  function clean(text: string) {
    return text.replace(/\s+/g, " ").trim();
  }
  function decodeEntities(value: string) {
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
  function parseSrvXml(xml: string): CaptionSegment[] {
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
  function parseCaptionBody(body: string): CaptionSegment[] {
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
  function captionBodyUsable(body: string) {
    return parseCaptionBody(body).length > 0;
  }
  function parseTimestamp(value: string) {
    const parts = value.trim().split(":");
    if (!parts.length || parts.some((part) => !/^\d+(\.\d+)?$/.test(part)))
      return NaN;
    return parts.reduce((total, part) => total * 60 + Number(part), 0);
  }
  function parsePanelRows(rows: PanelRow[]): CaptionSegment[] {
    return rows
      .map((row) => ({
        start: parseTimestamp(row.timestamp ?? ""),
        text: clean(row.text ?? ""),
      }))
      .filter((row) => row.text && Number.isFinite(row.start));
  }
  function chooseCaptionTrack<T extends CaptionTrack>(
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
  function allowedHost(hostname: string) {
    return (
      /(^|\.)youtube\.com$/.test(hostname) ||
      /(^|\.)googlevideo\.com$/.test(hostname)
    );
  }
  function timedTextUrl(baseUrl: string, pot?: string) {
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
  function trackNeedsPot(baseUrl: string) {
    try {
      const url = new URL(baseUrl);
      const exp = url.searchParams.get("exp") ?? "";
      return /(^|,)xpe(,|$)/.test(exp) && !url.searchParams.get("pot");
    } catch {
      return false;
    }
  }
  function extractPotUrl(resourceUrl: string, videoId: string) {
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
  function videoIdFromUrl(href: string): {
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
  function pickPlayingVideo<T extends VideoCandidate>(
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
  function retainNearPlayback(segments: CaptionSegment[], videoTime?: number) {
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
  function assembleTranscript(input: {
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
  function nodeText(node: DomNode | null | undefined) {
    return clean(node?.textContent ?? "");
  }
  function panelRows(doc: DomNode): PanelRow[] {
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
  async function readPanel(
    doc: DomNode,
    videoId: string,
    wait: CaptionEnv["wait"],
    now: CaptionEnv["now"],
  ) {
    const flexy = doc.querySelector?.("ytd-watch-flexy")?.getAttribute?.(
      "video-id",
    );
    if (flexy && flexy !== videoId) return [];
    let rows = panelRows(doc);
    if (rows.length) return rows;
    const opener = Array.from(doc.querySelectorAll?.("button") ?? []).find(
      (button) =>
        /transcript/i.test(
          `${button.getAttribute?.("aria-label") || ""} ${button.textContent || ""}`,
        ),
    );
    if (typeof opener?.click !== "function") return rows;
    try {
      opener.click();
    } catch {
      return rows;
    }
    const deadline = now() + PANEL_WAIT_MS;
    while (now() < deadline) {
      rows = panelRows(doc);
      if (rows.length) return rows;
      await wait(POLL_MS);
    }
    return panelRows(doc);
  }
  function collectCandidates(env: CaptionEnv) {
    const nodes = Array.from(
      env.document.querySelectorAll?.(
        ".html5-video-player, #movie_player, #shorts-player",
      ) ?? [],
    );
    const seen = new Set<DomNode>();
    const candidates: (VideoCandidate & {
      tracks: CaptionTrack[];
      player: DomNode;
    })[] = [];
    for (const player of nodes) {
      if (seen.has(player)) continue;
      seen.add(player);
      const response =
        typeof player.getPlayerResponse === "function"
          ? player.getPlayerResponse()
          : undefined;
      const videoId = response?.videoDetails?.videoId;
      const reel = player.closest?.("ytd-reel-video-renderer") ?? undefined;
      const reelId = reel?.getAttribute?.("video-id") || undefined;
      const video = player.querySelector?.("video") ?? reel?.querySelector?.("video");
      const rect = (video ?? player).getBoundingClientRect?.();
      const inView =
        !!rect &&
        rect.width > 0 &&
        rect.height > 40 &&
        rect.bottom > 0 &&
        rect.top < env.viewportHeight;
      const active = reel
        ? !!reel.hasAttribute?.("is-active")
        : !!player.classList?.contains?.("playing-mode") ||
          player.id === "movie_player";
      candidates.push({
        videoId: typeof videoId === "string" ? videoId : undefined,
        reelId: reelId || undefined,
        active,
        paused: video ? !!video.paused : undefined,
        currentTime:
          video && Number.isFinite(video.currentTime)
            ? video.currentTime
            : undefined,
        inView,
        tracks:
          response?.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
          [],
        player,
      });
    }
    return candidates;
  }
  function findPot(env: CaptionEnv, videoId: string, player?: DomNode) {
    for (const entry of env.performance.getEntriesByType("resource")) {
      const found = extractPotUrl(entry.name, videoId);
      if (found) return found;
    }
    const response =
      typeof player?.getPlayerResponse === "function"
        ? player.getPlayerResponse()
        : undefined;
    for (const track of response?.captions?.playerCaptionsTracklistRenderer
      ?.captionTracks ?? []) {
      if (typeof track.baseUrl === "string") {
        const found = extractPotUrl(track.baseUrl, videoId);
        if (found) return found;
      }
    }
    return;
  }
  function enableCaptions(player?: DomNode) {
    const button = player?.querySelector?.(".ytp-subtitles-button");
    if (button?.getAttribute?.("aria-pressed") === "true") return () => {};
    if (typeof player?.toggleSubtitles === "function") {
      try {
        player.toggleSubtitles();
      } catch {
        return () => {};
      }
      return () => {
        try {
          player.toggleSubtitles?.();
        } catch {
          /* Leave the player's own caption button as it is if it will not toggle. */
        }
      };
    }
    if (typeof button?.click === "function") {
      try {
        button.click();
      } catch {
        return () => {};
      }
      return () => {
        if (
          button.getAttribute?.("aria-pressed") === "true" &&
          typeof button.click === "function"
        ) {
          try {
            button.click();
          } catch {
            /* The button may already have been removed. */
          }
        }
      };
    }
    return () => {};
  }
  async function fetchText(env: CaptionEnv, url: string) {
    try {
      const response = await env.fetch(url);
      if (!response?.ok) return "";
      const text = await response.text();
      return typeof text === "string" ? text : "";
    } catch {
      return "";
    }
  }
  async function loadYoutubeCaptions(env: CaptionEnv) {
    const empty = {
      transcript: [] as CaptionSegment[],
      transcriptPartial: false,
      transcriptStatus: "unavailable" as const,
      videoTime: undefined as number | undefined,
    };
    const located = videoIdFromUrl(env.href);
    if (!located.id || located.kind === "other") return empty;
    let candidates = collectCandidates(env);
    let chosen = pickPlayingVideo(candidates, located.id, located.kind);
    if (!chosen && env.initialPlayerResponse?.videoDetails?.videoId === located.id) {
      const player =
        env.document.getElementById?.("movie_player") ??
        env.document.querySelector?.("#movie_player") ??
        undefined;
      chosen = {
        videoId: located.id,
        active: true,
        tracks:
          env.initialPlayerResponse.captions?.playerCaptionsTracklistRenderer
            ?.captionTracks ?? [],
        player: player ?? env.document,
      };
    }
    if (!chosen?.videoId) return empty;
    const videoId = chosen.videoId;
    const track = chooseCaptionTrack(chosen.tracks ?? [], env.lang || "");
    let fetchedBody = "";
    if (track?.baseUrl) {
      const url = timedTextUrl(track.baseUrl);
      if (url) fetchedBody = await fetchText(env, url);
    }
    let potBody = "";
    if (!captionBodyUsable(fetchedBody)) {
      let pot = findPot(env, videoId, chosen.player);
      if (!pot) {
        const seen: string[] = [];
        const unpatch = env.patchNetwork((url) => seen.push(url));
        const restore = enableCaptions(chosen.player);
        try {
          const deadline = env.now() + POT_WAIT_MS;
          while (!pot && env.now() < deadline) {
            pot = seen
              .map((url) => extractPotUrl(url, videoId))
              .find((url) => url);
            if (!pot) pot = findPot(env, videoId, chosen.player);
            if (!pot) await env.wait(POLL_MS);
          }
        } finally {
          try {
            unpatch();
          } catch {
            /* Restoring fetch/XHR must not hide a caption result. */
          }
          restore();
        }
      }
      if (pot) {
        const url = timedTextUrl(pot);
        if (url) potBody = await fetchText(env, url);
      }
    }
    let panel: PanelRow[] = [];
    if (!captionBodyUsable(potBody) && !captionBodyUsable(fetchedBody))
      panel = await readPanel(env.document, videoId, env.wait, env.now);
    const assembled = assembleTranscript({
      fetchedBody,
      potBody,
      panel,
      videoTime: chosen.currentTime,
    });
    return {
      videoTime: chosen.currentTime,
      ...assembled,
    };
  }
  return {
    parseCaptionBody,
    captionBodyUsable,
    parsePanelRows,
    chooseCaptionTrack,
    timedTextUrl,
    trackNeedsPot,
    extractPotUrl,
    videoIdFromUrl,
    pickPlayingVideo,
    retainNearPlayback,
    assembleTranscript,
    loadYoutubeCaptions,
  };
}
export type CaptionApi = ReturnType<typeof captionKit>;
