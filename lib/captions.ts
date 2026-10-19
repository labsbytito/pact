import { assembleTranscript, captionBodyUsable, chooseCaptionTrack, extractPotUrl, parseCaptionBody, parsePanelRows, pickPlayingVideo, retainNearPlayback, timedTextUrl, trackNeedsPot, videoIdFromUrl } from "./captions-parse";
import { loadYoutubeCaptions } from "./captions-dom";
export type { CaptionEnv, CaptionSegment, CaptionTrack, PanelRow, VideoCandidate } from "./captions-types";

export function captionKit() {
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
