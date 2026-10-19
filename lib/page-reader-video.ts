import type { CaptionApi } from "./captions";
import type { Source } from "./model";

export async function applyYoutubeCaptions(
  source: Source,
  caps: CaptionApi | undefined,
  initialUrl: string,
  isYoutube: boolean,
) {
    if (isYoutube && caps) {
      try {
        const loaded = await caps.loadYoutubeCaptions({
          href: initialUrl,
          lang: document.documentElement?.lang || "",
          viewportHeight: innerHeight,
          document,
          initialPlayerResponse: (
            globalThis as { ytInitialPlayerResponse?: unknown }
          ).ytInitialPlayerResponse as
            | {
                videoDetails?: { videoId?: string };
                captions?: {
                  playerCaptionsTracklistRenderer?: {
                    captionTracks?: { baseUrl?: string; languageCode?: string }[];
                  };
                };
              }
            | undefined,
          now: () => Date.now(),
          wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
          fetch: (captionUrl: string) =>
            fetch(captionUrl, {
              credentials: "include",
              signal: AbortSignal.timeout(8000),
            }),
          performance: {
            getEntriesByType: (type: string) =>
              performance
                .getEntriesByType(type)
                .map((entry) => ({ name: entry.name })),
          },
          patchNetwork: (onUrl: (seen: string) => void) => {
            const originalFetch = globalThis.fetch;
            const xhr = (
              globalThis as { XMLHttpRequest?: { prototype: { open: (...args: any[]) => unknown } } }
            ).XMLHttpRequest;
            const originalOpen = xhr?.prototype?.open;
            globalThis.fetch = function (this: unknown, input: any, init?: any) {
              try {
                const seen =
                  typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.href
                      : input?.url;
                if (seen) onUrl(String(seen));
              } catch {
                /* Observing a player request must not break it. */
              }
              return originalFetch.call(this, input, init);
            } as typeof fetch;
            if (xhr && originalOpen) {
              xhr.prototype.open = function (
                this: unknown,
                method: string,
                requestUrl: string | URL,
                ...rest: any[]
              ) {
                try {
                  onUrl(String(requestUrl));
                } catch {
                  /* Observing a player request must not break it. */
                }
                return originalOpen.apply(this, [method, requestUrl, ...rest]);
              };
            }
            return () => {
              globalThis.fetch = originalFetch;
              if (xhr && originalOpen) xhr.prototype.open = originalOpen;
            };
          },
        });
        if (typeof loaded.videoTime === "number")
          source.videoTime = loaded.videoTime;
        source.transcript = loaded.transcript;
        source.transcriptPartial = loaded.transcriptPartial;
        source.transcriptStatus = loaded.transcriptStatus;
      } catch {
        /* Speech is unavailable unless real captions were read. */
      }
    }
}
