import type { Source } from "./model";
export async function capturePage(): Promise<Source> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting)
    throw new Error(
      "Open Pact from its Chrome toolbar icon to read the page beside it. This browser preview can save Pacts, but cannot read other tabs.",
    );
  const invocation = (await chrome.storage.session.get('pactInvocation')).pactInvocation as
    | {tabId:number;windowId:number}
    | undefined;
  if (!invocation) throw new Error('Click Pact’s toolbar icon on this page to share its context.');
  const [tab] = await chrome.tabs.query({ active: true, windowId: invocation.windowId });
  if (tab?.id !== invocation.tabId) throw new Error('Click Pact’s toolbar icon on the page you want to share.');
  if (!tab?.id || !tab.url || !/^https?:/.test(tab.url))
    throw new Error(
      "Open a webpage, then click the Pact toolbar icon. Chrome protects internal pages and the Web Store.",
    );
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: async () => {
        const description =
          document.querySelector<HTMLMetaElement>(
            'meta[name="description"], meta[property="og:description"]',
          )?.content ?? "";
        const video = document.querySelector("video");
        const isYoutube =
          /(^|\.)youtube\.com$/.test(location.hostname) &&
          new URL(location.href).searchParams.has("v");
        const source: Source = {
          title: document.title,
          url: location.href,
          description,
          text: (
            (
              (document.querySelector(
                'article,main,[role="main"],shreddit-post',
              ) ?? document.body) as HTMLElement | null
            )?.innerText ?? ""
          )
            .replace(/\s+/g, " ")
            .slice(0, 16000),
          selection: window.getSelection()?.toString().slice(0, 4000) ?? "",
          capturedAt: new Date().toISOString(),
          videoTime: isYoutube ? video?.currentTime : undefined,
          transcript: [],
          transcriptStatus: isYoutube ? "unavailable" : "not-video",
        };
        if (isYoutube) {
          // Only read transcript rows already present. Never invent a transcript from the title.
          const rows = Array.from(
            document.querySelectorAll("ytd-transcript-segment-renderer"),
          );
          source.transcript = rows
            .map((row) => {
              const t =
                row.querySelector(".segment-timestamp")?.textContent?.trim() ??
                "0";
              return {
                start: t.split(":").reduce((n, v) => n * 60 + Number(v), 0),
                text:
                  row.querySelector(".segment-text")?.textContent?.trim() ?? "",
              };
            })
            .filter((x) => x.text);
          if (!source.transcript.length) {
            try {
              const player = (
                window as unknown as {
                  ytInitialPlayerResponse?: {
                    videoDetails?: { videoId: string };
                    captions?: {
                      playerCaptionsTracklistRenderer?: {
                        captionTracks?: {
                          baseUrl: string;
                          languageCode: string;
                        }[];
                      };
                    };
                  };
                }
              ).ytInitialPlayerResponse;
              if (
                player?.videoDetails?.videoId ===
                new URL(location.href).searchParams.get("v")
              ) {
                const tracks =
                  player.captions?.playerCaptionsTracklistRenderer
                    ?.captionTracks ?? [];
                const track =
                  tracks.find((t) => t.languageCode === "en") ?? tracks[0];
                if (track) {
                  const endpoint = new URL(track.baseUrl);
                  endpoint.searchParams.set("fmt", "json3");
                  if (
                    endpoint.protocol === "https:" &&
                    /(^|\.)youtube\.com$/.test(endpoint.hostname)
                  ) {
                    const res = await fetch(endpoint, {
                      signal: AbortSignal.timeout(8000),
                    });
                    if (res.ok) {
                      const body = await res.json();
                      source.transcript = (body.events ?? [])
                        .filter((e: any) => e.segs)
                        .map((e: any) => ({
                          start: (e.tStartMs ?? 0) / 1000,
                          text: e.segs
                            .map((s: any) => s.utf8 ?? "")
                            .join("")
                            .trim(),
                        }))
                        .filter((e: any) => e.text);
                    }
                  }
                }
              }
            } catch {
              /* Caption availability is reported below. */
            }
          }
          if (source.transcript.length > 4000) {
            const near = source.transcript.filter(
              (x) => Math.abs(x.start - (source.videoTime ?? 0)) <= 120,
            );
            const broad = source.transcript.filter(
              (_, i) => i % Math.ceil(source.transcript.length / 3800) === 0,
            );
            source.transcript = [
              ...new Map(
                [...near, ...broad].slice(0, 4000).map((x) => [x.start, x]),
              ).values(),
            ].sort((a, b) => a.start - b.start);
            source.transcriptPartial = true;
          }
          source.transcriptStatus = source.transcript.length
            ? "available"
            : "unavailable";
        }
        return source;
      },
    });
    const source = results[0]?.result as Source | undefined;
    if (!source) throw new Error("No page context returned.");
    return source;
  } catch (e) {
    throw new Error(
      `Chrome could not read this page. Click Pact’s toolbar icon on this tab and try again. ${e instanceof Error ? e.message : ""}`,
    );
  }
}
