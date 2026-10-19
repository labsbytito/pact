import type { CaptionEnv, CaptionSegment, CaptionTrack, DomNode, PanelRow, PlayerResponse, VideoCandidate } from "./captions-types";
import {
  clean,
  decodeEntities,
  parseSrvXml,
  parseCaptionBody,
  captionBodyUsable,
  parseTimestamp,
  parsePanelRows,
  chooseCaptionTrack,
  allowedHost,
  timedTextUrl,
  trackNeedsPot,
  extractPotUrl,
  videoIdFromUrl,
  pickPlayingVideo,
  retainNearPlayback,
  assembleTranscript,
  nodeText,
  panelRows,
} from "./captions-parse";

const POT_WAIT_MS = 4000;
const PANEL_WAIT_MS = 3000;
const POLL_MS = 200;

export async function readPanel(
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
export function collectCandidates(env: CaptionEnv) {
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
export function findPot(env: CaptionEnv, videoId: string, player?: DomNode) {
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
export function enableCaptions(player?: DomNode) {
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
export async function fetchText(env: CaptionEnv, url: string) {
  try {
    const response = await env.fetch(url);
    if (!response?.ok) return "";
    const text = await response.text();
    return typeof text === "string" ? text : "";
  } catch {
    return "";
  }
}
export async function loadYoutubeCaptions(env: CaptionEnv) {
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
