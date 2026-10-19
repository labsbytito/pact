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
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const seen = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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

test("shorts use the playing reel instead of a stale player response", async () => {
  const json3 = await read("json3.json");
  function reel(id: string, active: boolean, paused: boolean) {
    const player = {
      id: "movie_player",
      className: "html5-video-player",
      classList: { contains: () => false },
      querySelector: () => ({ paused, currentTime: active ? 4 : 20 }),
      querySelectorAll: () => [],
      closest: () => reelNode,
      getPlayerResponse: () => ({
        videoDetails: { videoId: id },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                baseUrl: `https://www.youtube.com/api/timedtext?v=${id}&lang=en`,
                languageCode: "en",
              },
            ],
          },
        },
      }),
    };
    const reelNode = {
      getAttribute: (name: string) => (name === "video-id" ? id : null),
      hasAttribute: (name: string) => name === "is-active" && active,
      querySelector: () => ({ paused, currentTime: active ? 4 : 20 }),
    };
    return player;
  }
  const previous = reel("previous", false, true);
  const playing = reel("playing", true, false);
  const fetched: string[] = [];
  const loaded = await caps.loadYoutubeCaptions(
    env({
      href: "https://www.youtube.com/shorts/previous",
      document: {
        querySelector: () => null,
        querySelectorAll: (selector: string) =>
          selector.includes("html5-video-player") ? [previous, playing] : [],
      },
      fetch: async (url) => {
        fetched.push(url);
        const body = url.includes("v=playing") ? json3 : "not captions";
        return { ok: true, text: async () => body };
      },
    }),
  );
  assert.equal(loaded.videoTime, 4);
  assert.ok(fetched.every((url) => url.includes("v=playing")));
  assert.match(loaded.transcript[0]?.text ?? "", /Kanazawa/);
});

test("the injected page reader uses the fixture parser when timedtext is empty", async (t) => {
  const json3 = await read("json3.json");
  const previous = {
    document: globalThis.document,
    location: (globalThis as { location?: unknown }).location,
    window: (globalThis as { window?: unknown }).window,
    fetch: globalThis.fetch,
    Element: (globalThis as { Element?: unknown }).Element,
    NodeFilter: (globalThis as { NodeFilter?: unknown }).NodeFilter,
    getComputedStyle: globalThis.getComputedStyle,
    innerHeight: (globalThis as { innerHeight?: number }).innerHeight,
    innerWidth: (globalThis as { innerWidth?: number }).innerWidth,
  };
  t.after(() => {
    Object.assign(globalThis, previous);
  });
  const button = {
    attrs: { "aria-pressed": "false" } as Record<string, string>,
    className: "ytp-subtitles-button",
    textContent: "",
    parent: null as any,
    getAttribute(name: string) {
      return this.attrs[name] ?? null;
    },
  };
  let toggles = 0;
  const video = { paused: false, currentTime: 8.2, tagName: "VIDEO", className: "", id: "", children: [] as any[], parent: null as any };
  const player: any = {
    id: "movie_player",
    className: "html5-video-player",
    tagName: "DIV",
    textContent: "",
    children: [] as any[],
    parent: null as any,
    attrs: {},
    classList: {
      contains(name: string) {
        return player.className.split(/\s+/).includes(name);
      },
    },
    getAttribute() {
      return null;
    },
    hasAttribute() {
      return false;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, bottom: 200, right: 300, width: 300, height: 200 };
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
      button.attrs["aria-pressed"] = toggles % 2 ? "true" : "false";
      void globalThis.fetch(
        "https://www.youtube.com/api/timedtext?v=abc&pot=player-token&lang=en",
      );
    },
  };
  button.parent = player;
  video.parent = player;
  player.children = [video, button];
  const body = {
    tagName: "BODY",
    id: "",
    className: "",
    textContent: "",
    children: [] as any[],
    parent: null as any,
    classList: { contains: () => false },
    getAttribute: () => null,
    hasAttribute: () => false,
    getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
  };
  const flexy = {
    tagName: "YTD-WATCH-FLEXY",
    id: "",
    className: "",
    textContent: "",
    children: [] as any[],
    parent: null as any,
    attrs: { "video-id": "abc" },
    classList: { contains: () => false },
    getAttribute(name: string) {
      return this.attrs[name as "video-id"] ?? null;
    },
    hasAttribute(name: string) {
      return name in this.attrs;
    },
    getBoundingClientRect: body.getBoundingClientRect,
  };
  const nodes = [body, player, video, button, flexy];
  for (const node of nodes) {
    node.querySelector = (selector: string) => node.querySelectorAll(selector)[0] ?? null;
    node.querySelectorAll = (selector: string) => query(node, selector);
    node.closest = (selector: string) => {
      let current: any = node;
      while (current) {
        if (one(current, selector)) return current;
        current = current.parent;
      }
      return null;
    };
  }
  player.children = [video, button];
  video.parent = player;
  button.parent = player;
  const doc: any = {
    title: "Kanazawa walk",
    body,
    documentElement: { lang: "en" },
    children: [body, player, flexy],
    createTreeWalker: () => ({ nextNode: () => null }),
    createElement: () => ({ style: {}, remove() {}, dataset: {} }),
    getElementById: (id: string) => (id === "movie_player" ? player : null),
  };
  body.parent = doc;
  player.parent = doc;
  flexy.parent = doc;
  doc.querySelector = (selector: string) => doc.querySelectorAll(selector)[0] ?? null;
  doc.querySelectorAll = (selector: string) => query(doc, selector);
  function one(node: any, selector: string) {
    if (selector === "*") return true;
    if (selector.startsWith("#")) return node.id === selector.slice(1);
    if (selector.startsWith("."))
      return String(node.className ?? "").split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith("[")) return false;
    return String(node.tagName ?? "").toUpperCase() === selector.toUpperCase();
  }
  function query(rootNode: any, selector: string): any[] {
    const parts = selector.split(",").map((part) => part.trim());
    const found: any[] = [];
    const walk = (node: any) => {
      for (const child of node.children ?? []) {
        if (parts.some((part) => one(child, part))) found.push(child);
        walk(child);
      }
    };
    walk(rootNode);
    return found;
  }
  Object.assign(globalThis, {
    document: doc,
    location: { href: "https://www.youtube.com/watch?v=abc" },
    window: { getSelection: () => null },
    Element: class Element {},
    NodeFilter: { SHOW_TEXT: 4 },
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    innerHeight: 800,
    innerWidth: 400,
    fetch: async (input: any) => {
      const url = String(typeof input === "string" ? input : input?.url ?? input);
      const bodyText = url.includes("pot=") ? json3 : await read("empty-body.txt");
      return { ok: true, text: async () => bodyText };
    },
  });
  assert.match(caps.parseCaptionBody.toString(), /tStartMs/);
  assert.match(caps.loadYoutubeCaptions.toString(), /timedTextUrl/);
  const source = await readPageSnapshot("page", "", caps);
  assert.ok(!("captureError" in source), "captureError" in source ? source.captureError : "");
  if ("captureError" in source) return;
  assert.equal(source.transcriptStatus, "available");
  assert.equal(source.videoTime, 8.2);
  assert.match(source.transcript.map((line) => line.text).join(" "), /Bring a coat/);
  assert.equal(toggles, 2);
});
