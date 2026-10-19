import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { captionKit, type CaptionEnv } from "../lib/captions";
import { readPageSnapshot } from "../lib/page-reader";

const caps = captionKit();
const root = new URL("./fixtures/captions/", import.meta.url);
const read = (name: string) => readFile(new URL(name, root), "utf8");

function clock() {
  let time = 0;
  return {
    now: () => time,
    wait: async (ms: number) => {
      time += ms;
    },
  };
}

test("json3 fixtures keep speech near the playback time and ignore empty bodies", async () => {
  const json3 = await read("json3.json");
  const empty = await read("empty-body.txt");
  const xml = await read("srv3.xml");
  const panel = JSON.parse(await read("panel.json")) as {
    timestamp: string;
    text: string;
  }[];
  assert.equal(empty.trim(), "");
  assert.equal(caps.captionBodyUsable(empty), false);
  assert.equal(caps.captionBodyUsable("   "), false);
  assert.equal(caps.captionBodyUsable("{not json"), false);
  assert.throws(() => JSON.parse(empty));
  const parsed = caps.parseCaptionBody(json3);
  assert.deepEqual(parsed, [
    { start: 1.25, text: "The town is Kanazawa." },
    { start: 8.6, text: "Visit the garden next year. Bring a coat." },
  ]);
  assert.deepEqual(caps.parseCaptionBody(xml), [
    { start: 1.25, text: "The town is Kanazawa." },
    { start: 8.6, text: "Visit the garden & castle." },
  ]);
  assert.deepEqual(caps.parsePanelRows(panel), [
    { start: 1, text: "The town is Kanazawa." },
    { start: 62, text: "Visit the garden." },
    { start: 3723, text: "Later in the film." },
  ]);
  const fromPot = caps.assembleTranscript({
    fetchedBody: empty,
    potBody: json3,
    panel,
    videoTime: 8,
  });
  assert.equal(fromPot.transcriptStatus, "available");
  assert.equal(fromPot.transcript[1]?.text.includes("Kanazawa"), false);
  assert.match(fromPot.transcript.at(-1)?.text ?? "", /Bring a coat/);
  const fromPanel = caps.assembleTranscript({
    fetchedBody: empty,
    potBody: "",
    panel,
    videoTime: 60,
  });
  assert.equal(fromPanel.transcriptStatus, "available");
  assert.equal(fromPanel.transcript[1]?.start, 62);
  const none = caps.assembleTranscript({
    fetchedBody: empty,
    potBody: "{\"events\":[]}",
    panel: [],
    videoTime: 0,
  });
  assert.equal(none.transcriptStatus, "unavailable");
  assert.deepEqual(none.transcript, []);
  const near = caps.retainNearPlayback(
    Array.from({ length: 2500 }, (_, index) => ({
      start: index,
      text: `line ${index}`,
    })),
    2400,
  );
  assert.equal(near.partial, true);
  assert.ok(near.segments.length <= 2000);
  assert.equal(near.segments.at(-1)?.start, 2499);
  assert.ok(near.segments.some((line) => line.start === 2400));
});

test("caption URLs require a youtube host and a pot when exp=xpe is set", () => {
  const base =
    "https://www.youtube.com/api/timedtext?v=abc&lang=en&exp=xpe";
  assert.equal(caps.trackNeedsPot(base), true);
  assert.equal(
    caps.trackNeedsPot(`${base}&pot=player-token`),
    false,
  );
  const timed = caps.timedTextUrl(base, "player-token");
  assert.ok(timed?.includes("fmt=json3"));
  assert.ok(timed?.includes("pot=player-token"));
  assert.equal(caps.timedTextUrl("http://www.youtube.com/api/timedtext?v=abc"), undefined);
  assert.equal(
    caps.timedTextUrl("https://evil.example/api/timedtext?v=abc"),
    undefined,
  );
  assert.equal(
    caps.extractPotUrl(
      "https://www.youtube.com/api/timedtext?v=abc&pot=player-token",
      "abc",
    ),
    "https://www.youtube.com/api/timedtext?v=abc&pot=player-token",
  );
  assert.equal(
    caps.extractPotUrl(
      "https://www.youtube.com/api/timedtext?v=other&pot=player-token",
      "abc",
    ),
    undefined,
  );
  assert.deepEqual(caps.videoIdFromUrl("https://www.youtube.com/watch?v=abc"), {
    id: "abc",
    kind: "watch",
  });
  assert.deepEqual(
    caps.videoIdFromUrl("https://www.youtube.com/shorts/shortId/"),
    { id: "shortId", kind: "shorts" },
  );
});

test("track choice prefers the page language and shorts follow the playing video", () => {
  const tracks = [
    { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=en", languageCode: "en", kind: "asr" },
    { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=ja", languageCode: "ja" },
    { baseUrl: "https://www.youtube.com/api/timedtext?v=1&lang=ja-asr", languageCode: "ja", kind: "asr" },
  ];
  assert.equal(caps.chooseCaptionTrack(tracks, "ja-JP")?.languageCode, "ja");
  assert.equal(caps.chooseCaptionTrack(tracks, "ja")?.kind, undefined);
  assert.equal(caps.chooseCaptionTrack(tracks, "fr")?.languageCode, "en");
  const shorts = [
    { videoId: "previous", reelId: "previous", active: false, paused: true, currentTime: 3 },
    { videoId: "playing", reelId: "playing", active: true, paused: false, currentTime: 12, inView: true },
    { videoId: "stale", reelId: "playing", active: true, paused: false, currentTime: 1 },
  ];
  assert.equal(
    caps.pickPlayingVideo(shorts, "previous", "shorts")?.videoId,
    "playing",
  );
  assert.equal(
    caps.pickPlayingVideo(
      [{ videoId: "other", active: true, paused: false, currentTime: 4 }],
      "abc",
      "watch",
    ),
    undefined,
  );
  assert.equal(
    caps.pickPlayingVideo(
      [{ videoId: "abc", active: true, paused: false, currentTime: 9 }],
      "abc",
      "watch",
    )?.currentTime,
    9,
  );
});

function env(partial: Partial<CaptionEnv> & Pick<CaptionEnv, "href" | "document" | "fetch">): CaptionEnv {
  const time = clock();
  return {
    lang: "en",
    viewportHeight: 800,
    now: time.now,
    wait: time.wait,
    performance: { getEntriesByType: () => [] },
    patchNetwork: (onUrl) => {
      const original = globalThis.fetch;
      globalThis.fetch = ((input: any, init?: any) => {
        const seen =
          typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
        if (seen) onUrl(String(seen));
        return original(input, init);
      }) as typeof fetch;
      return () => {
        globalThis.fetch = original;
      };
    },
    initialPlayerResponse: undefined,
    ...partial,
  };
}

test("an empty timedtext body falls back to the player pot token", async () => {
  const json3 = await read("json3.json");
  let toggles = 0;
  const button = {
    attrs: { "aria-pressed": "false" },
    getAttribute(name: string) {
      return this.attrs[name as "aria-pressed"] ?? null;
    },
    className: "ytp-subtitles-button",
    textContent: "",
  };
  const player = {
    id: "movie_player",
    className: "html5-video-player",
    classList: { contains: (name: string) => name === "html5-video-player" },
    children: [] as any[],
    querySelector(selector: string) {
      return selector.includes("ytp-subtitles-button") ? button : selector === "video" ? video : null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    getPlayerResponse: () => ({
      videoDetails: { videoId: "abc" },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=abc&lang=en&exp=xpe",
              languageCode: "en",
            },
          ],
        },
      },
    }),
    toggleSubtitles() {
      toggles++;
      button.attrs["aria-pressed"] = toggles % 2 === 1 ? "true" : "false";
      void globalThis.fetch(
        "https://www.youtube.com/api/timedtext?v=abc&lang=en&pot=player-token",
      );
    },
  };
  const video = { paused: false, currentTime: 8.2, tagName: "VIDEO" };
  const doc = {
    querySelectorAll(selector: string) {
      if (selector.includes("html5-video-player") || selector.includes("movie_player"))
        return [player];
      return [];
    },
    querySelector() {
      return null;
    },
  };
  const fetched: string[] = [];
  const loaded = await caps.loadYoutubeCaptions(
    env({
      href: "https://www.youtube.com/watch?v=abc",
      document: doc,
      fetch: async (url) => {
        fetched.push(url);
        const body = url.includes("pot=") ? json3 : await read("empty-body.txt");
        return { ok: true, text: async () => body };
      },
    }),
  );
  assert.equal(loaded.transcriptStatus, "available");
  assert.equal(loaded.videoTime, 8.2);
  assert.match(loaded.transcript.map((line) => line.text).join(" "), /Kanazawa/);
  assert.ok(fetched.some((url) => url.includes("fmt=json3") && url.includes("pot=player-token")));
  assert.equal(toggles, 2);
  assert.equal(button.attrs["aria-pressed"], "false");
});

test("captions fall back to the transcript panel and otherwise stay unavailable", async () => {
  const panel = JSON.parse(await read("panel.json")) as {
    timestamp: string;
    text: string;
  }[];
  let opened = false;
  const rows = panel.slice(0, 2).map((row) => ({
    querySelector(selector: string) {
      if (selector.includes("timestamp")) return { textContent: row.timestamp };
      if (selector.includes("segment-text")) return { textContent: row.text };
      return null;
    },
  }));
  const doc = {
    querySelector(selector: string) {
      if (selector === "ytd-watch-flexy")
        return { getAttribute: () => "abc" };
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes("html5-video-player")) return [player];
      if (selector.includes("ytd-transcript-segment-renderer"))
        return opened ? rows : [];
      if (selector === "button") return [opener];
      return [];
    },
  };
  const opener = {
    textContent: "Show transcript",
    getAttribute: () => "Show transcript",
    click() {
      opened = true;
    },
  };
  const player = {
    id: "movie_player",
    className: "html5-video-player",
    classList: { contains: () => false },
    querySelector(selector: string) {
      return selector === "video" ? { paused: false, currentTime: 61 } : null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    getPlayerResponse: () => ({
      videoDetails: { videoId: "abc" },
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=abc&exp=xpe&lang=en",
              languageCode: "en",
            },
          ],
        },
      },
    }),
  };
  const loaded = await caps.loadYoutubeCaptions(
    env({
      href: "https://www.youtube.com/watch?v=abc",
      document: doc,
      fetch: async () => ({ ok: true, text: async () => await read("empty-body.txt") }),
    }),
  );
  assert.equal(opened, true);
  assert.equal(loaded.transcriptStatus, "available");
  assert.equal(loaded.transcript[1]?.text, "Visit the garden.");
  const missing = await caps.loadYoutubeCaptions(
    env({
      href: "https://www.youtube.com/watch?v=abc",
      document: {
        querySelector() {
          return { getAttribute: () => "abc" };
        },
        querySelectorAll(selector: string) {
          if (selector.includes("html5-video-player"))
            return [
              {
                id: "movie_player",
                classList: { contains: () => false },
                querySelector: () => ({ paused: true, currentTime: 1 }),
                querySelectorAll: () => [],
                closest: () => null,
                getPlayerResponse: () => ({
                  videoDetails: { videoId: "abc" },
                  captions: { playerCaptionsTracklistRenderer: { captionTracks: [] } },
                }),
              },
            ];
          return [];
        },
      },
      fetch: async () => ({ ok: true, text: async () => "" }),
    }),
  );
  assert.equal(missing.transcriptStatus, "unavailable");
  assert.deepEqual(missing.transcript, []);
});

