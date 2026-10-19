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

export type Rect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};
export type PlayerResponse = {
  videoDetails?: { videoId?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
};
export type DomNode = {
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
