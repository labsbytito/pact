import type { Source } from "./model";
export type CaptureMode = "page" | "selection" | "pick";
// Self-contained: Chrome serializes this function into the invoked page.
export async function readPageSnapshot(
  mode: CaptureMode = "page",
  suppliedSelection = "",
): Promise<Source | { captureError: string }> {
  try {
    const initialUrl = location.href;
    const clean = (text: string) => text.replace(/\s+/g, " ").trim();
    const blocked = (element: Element) =>
      !!element.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[data-pact-picker]',
      );
    let picked: Element | undefined;
    if (mode === "pick") {
      picked = await new Promise<Element>((resolve, reject) => {
        const overlay = document.createElement("div");
        overlay.dataset.pactPicker = "true";
        overlay.style.cssText =
          "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #dc735d;background:#dc735d12;border-radius:5px;display:none;";
        const hint = document.createElement("div");
        hint.dataset.pactPicker = "true";
        hint.textContent = "Pact · Click an item to share it · Esc to cancel";
        hint.style.cssText =
          "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);pointer-events:none;background:#292a2e;color:white;padding:10px 16px;border-radius:9px;font:14px system-ui;max-width:90vw;text-align:center;";
        document.documentElement.append(overlay, hint);
        let target: Element | undefined;
        const choose = (event: MouseEvent) => {
          const hit = event
            .composedPath()
            .find((node) => node instanceof Element && !blocked(node)) as
            Element | undefined;
          if (
            !hit ||
            hit === document.documentElement ||
            hit === document.body ||
            blocked(event.target as Element)
          ) {
            target = undefined;
            overlay.style.display = "none";
            return;
          }
          target =
            hit.closest(
              'shreddit-post,article,[role="article"],[data-testid="post-container"],figure,li,p,h1,h2,h3,h4,a',
            ) ?? hit;
          const rect = target.getBoundingClientRect();
          Object.assign(overlay.style, {
            display: "block",
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
        };
        const cleanup = () => {
          overlay.remove();
          hint.remove();
          window.removeEventListener("mousemove", choose, true);
          window.removeEventListener("click", click, true);
          for (const type of [
            "pointerdown",
            "pointerup",
            "mousedown",
            "mouseup",
          ] as const)
            window.removeEventListener(type, blockActivation, true);
          window.removeEventListener("keydown", key, true);
          clearTimeout(timer);
        };
        const blockActivation = (event: MouseEvent) => {
          choose(event);
          if (target) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        };
        const click = (event: MouseEvent) => {
          choose(event);
          if (!target) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const selected = target;
          cleanup();
          resolve(selected);
        };
        const key = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopImmediatePropagation();
            cleanup();
            reject(new Error("Selection cancelled."));
          }
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(
            new Error("Selection timed out. Choose Select item to try again."),
          );
        }, 45000);
        window.addEventListener("mousemove", choose, true);
        window.addEventListener("click", click, true);
        for (const type of [
          "pointerdown",
          "pointerup",
          "mousedown",
          "mouseup",
        ] as const)
          window.addEventListener(type, blockActivation, true);
        window.addEventListener("keydown", key, true);
      });
    }
    if (location.href !== initialUrl)
      throw new Error("The page changed. Read the current page again.");
    const roots: (Document | ShadowRoot)[] = [document];
    // Open shadow DOM contains the actual post text on modern Reddit and other sites.
    for (let i = 0; i < roots.length && i < 60; i++)
      for (const element of Array.from(roots[i]!.querySelectorAll("*")).slice(
        0,
        12000,
      ))
        if (element.shadowRoot && roots.length < 60)
          roots.push(element.shadowRoot);
    const textOf = (element: Element): string => {
      if (blocked(element)) return "";
      const parts: string[] = [];
      let length = 0,
        visited = 0;
      const subtrees: (Element | ShadowRoot)[] = [element];
      for (let i = 0; i < subtrees.length && i < 40 && length < 32000; i++) {
        const root = subtrees[i]!;
        for (const host of [
          root,
          ...Array.from(root.querySelectorAll("*")).slice(0, 4000),
        ])
          if (host instanceof Element && host.shadowRoot && !blocked(host))
            subtrees.push(host.shadowRoot);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while (
          (node = walker.nextNode()) &&
          visited++ < 18000 &&
          length < 32000
        ) {
          const parent = node.parentElement;
          if (
            !parent ||
            blocked(parent) ||
            parent.closest(
              'script,style,noscript,nav,aside,footer,[aria-hidden="true"]',
            )
          )
            continue;
          const value = clean(node.textContent ?? "");
          if (!value) continue;
          const style = getComputedStyle(parent);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          parts.push(value);
          length += value.length;
        }
      }
      return clean(parts.join(" ")).slice(0, 32000);
    };
    const selection = window.getSelection();
    const selectionElement = selection?.anchorNode?.parentElement;
    const selectedText = clean(
      suppliedSelection ||
        (selectionElement && !blocked(selectionElement)
          ? (selection?.toString() ?? "")
          : ""),
    );
    if (picked && !picked.isConnected)
      throw new Error("The selected item changed. Select it again.");
    const pickedText = picked
      ? textOf(picked) ||
        picked.getAttribute("alt") ||
        picked.getAttribute("aria-label") ||
        ""
      : "";
    if (picked && !pickedText)
      throw new Error(
        "This item has no readable text. Highlight a passage instead.",
      );
    if (mode === "selection" && !selectedText)
      throw new Error(
        "Highlight text on the page, then right-click “Make a Pact from selection”, or use Select item.",
      );
    // Read only rendered text intersecting the viewport. Exclude navigation and input values.
    const visible: string[] = [];
    let visibleLength = 0,
      visited = 0;
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while (
        (node = walker.nextNode()) &&
        visited++ < 18000 &&
        visibleLength < 14000
      ) {
        const parent = node.parentElement;
        const value = clean(node.textContent ?? "");
        if (
          !parent ||
          !value ||
          blocked(parent) ||
          parent.closest(
            'script,style,noscript,nav,header,footer,aside,[aria-hidden="true"]',
          )
        )
          continue;
        const style = getComputedStyle(parent);
        if (
          style.visibility === "hidden" ||
          style.display === "none" ||
          Number(style.opacity) === 0
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          rect.right > 0 &&
          rect.left < innerWidth
        ) {
          visible.push(value);
          visibleLength += value.length;
        }
      }
    }
    const viewportText = clean(visible.join(" ")).slice(0, 12000);
    const anchor = picked ?? selectionElement;
    const surrounding = anchor?.closest(
      'shreddit-post,article,[role="article"],[data-testid="post-container"],section,li',
    );
    const candidates = roots.flatMap((root) =>
      Array.from(
        root.querySelectorAll(
          'shreddit-post,article,[role="article"],[data-testid="post-container"],main,[role="main"]',
        ),
      ),
    );
    const score = (element: Element) => {
      const r = element.getBoundingClientRect();
      const area =
        Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) *
        Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      return (
        area *
        (element.matches(
          'article,shreddit-post,[role="article"],[data-testid="post-container"]',
        )
          ? 1.3
          : 1)
      );
    };
    const content =
      surrounding ??
      candidates.sort((a, b) => score(b) - score(a))[0] ??
      document.body;
    const articleText = content ? textOf(content) : "";
    const selectionContext = surrounding
      ? textOf(surrounding).slice(0, 6000)
      : pickedText.slice(0, 6000);
    const quote = (pickedText || selectedText).slice(0, 6000);
    const combined = [
      quote && `Selected item: ${quote}`,
      viewportText && `Visible on screen: ${viewportText}`,
      articleText && `Page content: ${articleText.slice(0, 14000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const url = new URL(initialUrl);
    const isYoutube =
      /(^|\.)youtube\.com$/.test(url.hostname) &&
      (url.searchParams.has("v") || url.pathname.startsWith("/shorts/"));
    const video = document.querySelector("video");
    const source: Source = {
      title: document.title.slice(0, 1000),
      url: initialUrl,
      description:
        document
          .querySelector<HTMLMetaElement>(
            'meta[name="description"],meta[property="og:description"]',
          )
          ?.content.slice(0, 4000) ?? "",
      text: combined.slice(0, 24000),
      selection: quote,
      capturedAt: new Date().toISOString(),
      captureMode: mode === "pick" ? "picked" : mode,
      viewportText,
      selectionContext,
      selectionLabel: picked?.tagName.toLowerCase(),
      pageTextPartial:
        combined.length > 24000 ||
        visited >= 18000 ||
        visibleLength >= 14000 ||
        articleText.length >= 32000,
      videoTime: isYoutube ? video?.currentTime : undefined,
      transcript: [],
      transcriptStatus: isYoutube ? "unavailable" : "not-video",
    };
    if (isYoutube) {
      const videoId =
        url.searchParams.get("v") ??
        url.pathname.split("/shorts/")[1]?.split("/")[0];
      type Player = {
        videoDetails?: { videoId: string };
        captions?: {
          playerCaptionsTracklistRenderer?: {
            captionTracks?: { baseUrl: string; languageCode: string }[];
          };
        };
      };
      const playerElement = document.getElementById("movie_player") as
        (HTMLElement & { getPlayerResponse?: () => Player }) | null;
      const player =
        playerElement?.getPlayerResponse?.() ??
        (window as unknown as { ytInitialPlayerResponse?: Player })
          .ytInitialPlayerResponse;
      // Never use a previous video's player response after YouTube SPA navigation.
      if (videoId && player && player.videoDetails?.videoId === videoId) {
        try {
          const tracks =
            player.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
            [];
          const track =
            tracks.find(
              (t) =>
                t.languageCode === document.documentElement.lang.split("-")[0],
            ) ??
            tracks.find((t) => t.languageCode === "en") ??
            tracks[0];
          if (track) {
            const endpoint = new URL(track.baseUrl);
            endpoint.searchParams.set("fmt", "json3");
            if (
              endpoint.protocol === "https:" &&
              /(^|\.)youtube\.com$/.test(endpoint.hostname)
            ) {
              const response = await fetch(endpoint, {
                signal: AbortSignal.timeout(8000),
              });
              if (response.ok) {
                const body = await response.json();
                source.transcript = (body.events ?? [])
                  .filter((e: any) => Array.isArray(e.segs))
                  .map((e: any) => ({
                    start: (e.tStartMs ?? 0) / 1000,
                    text: clean(e.segs.map((s: any) => s.utf8 ?? "").join("")),
                  }))
                  .filter((e: any) => e.text && Number.isFinite(e.start));
              }
            }
          }
        } catch {
          /* Speech is unavailable unless real captions were read. */
        }
        if (
          !source.transcript.length &&
          document
            .querySelector("ytd-watch-flexy")
            ?.getAttribute("video-id") === videoId
        ) {
          source.transcript = Array.from(
            document.querySelectorAll("ytd-transcript-segment-renderer"),
          )
            .map((row) => ({
              start: (
                row.querySelector(".segment-timestamp")?.textContent?.trim() ??
                "0"
              )
                .split(":")
                .reduce((n, v) => n * 60 + Number(v), 0),
              text: clean(
                row.querySelector(".segment-text")?.textContent ?? "",
              ),
            }))
            .filter((row) => row.text && Number.isFinite(row.start));
        }
      }
      let budget = 100000;
      const sorted = [...source.transcript].sort(
        (a, b) =>
          Math.abs(a.start - (source.videoTime ?? 0)) -
          Math.abs(b.start - (source.videoTime ?? 0)),
      );
      const retained: Source["transcript"] = [];
      for (const line of sorted) {
        if (retained.length >= 2000 || budget <= 0) break;
        const text = line.text.slice(0, Math.min(1000, budget));
        budget -= text.length;
        retained.push({ ...line, text });
      }
      source.transcriptPartial =
        retained.length < source.transcript.length ||
        source.transcript.some((x) => x.text.length > 1000);
      source.transcript = retained.sort((a, b) => a.start - b.start);
      source.transcriptStatus = source.transcript.length
        ? "available"
        : "unavailable";
    }
    if (location.href !== initialUrl)
      throw new Error(
        "The page changed while Pact was reading it. Read the current page again.",
      );
    return source;
  } catch (error) {
    // Chrome does not consistently propagate exceptions from injected functions.
    // Return a small serializable envelope so cancellation keeps its meaning.
    return {
      captureError:
        error instanceof Error ? error.message : "The page could not be read.",
    };
  }
}
