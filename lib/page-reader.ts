import { captionKit, type CaptionApi } from "./captions";
import type { Source } from "./model";
export type CaptureMode = "page" | "selection" | "pick";
// Chrome serializes this function into the page. Caption helpers arrive as `caps`
// from createInjectedPageReader so the pot/transcript fallback is the tested one.
export async function readPageSnapshot(
  mode: CaptureMode = "page",
  suppliedSelection = "",
  caps?: CaptionApi,
): Promise<Source | { captureError: string }> {
  try {
    const initialUrl = location.href;
    const clean = (text: string) => text.replace(/\s+/g, " ").trim();
    const amount = () => clean(document.body?.textContent || "").length;
    const queryAll = (
      root: { querySelectorAll?: (selector: string) => Iterable<Element> },
      selector: string,
    ) =>
      typeof root?.querySelectorAll === "function"
        ? Array.from(root.querySelectorAll(selector))
        : [];
    const shadowRoots = () => {
      const roots: (Document | ShadowRoot)[] = [document];
      for (let i = 0; i < roots.length && i < 100; i++)
        for (const element of queryAll(roots[i]!, "*").slice(0, 12000))
          if (element.shadowRoot && roots.length < 80)
            roots.push(element.shadowRoot);
      return roots;
    };
    const settleReadableContent = async () => {
      if (typeof MutationObserver !== "function" || amount() > 500) return;
      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          try {
            observer.disconnect();
          } catch {
            /* The page may already have gone away. */
          }
          resolve();
        };
        const observer = new MutationObserver(() => {
          if (amount() > 500) finish();
        });
        try {
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        } catch {
          finish();
          return;
        }
        setTimeout(finish, 1500);
      });
    };
    const blockText = () => {
      const blocks: string[] = [];
      const seen = new Set<Element>();
      let length = 0;
      for (const root of shadowRoots())
        for (const el of queryAll(
          root,
          "article p, main p, p, h1, h2, h3, li, blockquote, pre",
        ).slice(0, 500)) {
          if (seen.has(el)) continue;
          seen.add(el);
          if (el.closest("nav,footer,aside,script,style,noscript")) continue;
          const value = clean(el.textContent || "");
          if (value.length < 30) continue;
          blocks.push(value);
          length += value.length;
          if (length > 14000) return clean(blocks.join("\n")).slice(0, 14000);
        }
      return clean(blocks.join("\n")).slice(0, 14000);
    };
    const grabText = (selector: string, limit: number) => {
      const found: string[] = [];
      for (const root of shadowRoots()) {
        for (const node of queryAll(root, selector)) {
          if (found.length >= limit) return found;
          const value = clean(node.textContent || "");
          if (value.length > 1) found.push(value);
        }
      }
      return found;
    };
    const siteSpecificText = () => {
      const host = location.hostname;
      if (/(^|\.)youtube\.com$/.test(host)) {
        const description = grabText(
          "#description-inline-expander, #attributed-snippet-text, ytd-text-inline-expander, ytd-watch-metadata #description, #description yt-formatted-string",
          4,
        );
        const comments = grabText(
          "ytd-comment-view-model #content-text, ytd-comment-thread-renderer #content-text, #content-text",
          30,
        );
        return [
          description.length ? `Description: ${description.join(" ")}` : "",
          comments.length ? `Comments: ${comments.join(" · ")}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      }
      if (/(^|\.)reddit\.com$/.test(host))
        return [
          grabText("shreddit-comment", 30).join("\n"),
          grabText(".comment .usertext-body, .comment .md", 30).join("\n"),
        ]
          .filter(Boolean)
          .join("\n");
      if (/(^|\.)quora\.com$/.test(host))
        return grabText(".q-text, .qu-userSelect--text", 20).join("\n");
      if (/(^|\.)x\.com$/.test(host) || /(^|\.)twitter\.com$/.test(host))
        return grabText("[data-testid='tweetText']", 20).join("\n");
      if (/(^|\.)github\.com$/.test(host))
        return grabText("article.markdown-body, #readme", 12).join("\n");
      return "";
    };
    const consentNote = () => {
      const dialog = document.querySelector(
        "#onetrust-banner-sdk, [aria-label*='cookie' i], [aria-label*='consent' i]",
      );
      const value = clean(dialog?.textContent || "");
      if (value.length < 40) return "";
      return "A cookie or sign-in prompt is on this page. Pact did not accept it.";
    };
    const nudgeComments = async () => {
      const host = location.hostname;
      const mayHaveComments =
        /(^|\.)youtube\.com$/.test(host) ||
        /(^|\.)reddit\.com$/.test(host) ||
        !!document.querySelector(
          "ytd-comments, #comments, shreddit-comment-tree",
        );
      if (!mayHaveComments) return;
      const scroller = document.scrollingElement;
      if (!scroller) return;
      const start = scroller.scrollTop;
      const comments = () =>
        document.querySelector(
          "ytd-comments, #comments, shreddit-comment-tree",
        );
      try {
        const first = comments();
        if (first && typeof first.scrollIntoView === "function")
          first.scrollIntoView({ block: "start" });
        for (let step = 0; step < 4; step++) {
          scroller.scrollTop = Math.min(
            scroller.scrollHeight,
            scroller.scrollTop + Math.max(innerHeight, 700),
          );
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (comments() && step >= 1) break;
        }
      } finally {
        scroller.scrollTop = start;
      }
    };
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
    if (mode !== "pick") {
      await settleReadableContent();
      try {
        await nudgeComments();
      } catch {
        /* A scroll that the page rejects should not hide text already on screen. */
      }
      if (location.href !== initialUrl)
        throw new Error("The page changed. Read the current page again.");
    }
    // Open shadow DOM contains the actual post text on modern Reddit and other sites.
    const roots = shadowRoots();
    const textOf = (element: Element): string => {
      if (blocked(element)) return "";
      const parts: string[] = [];
      let length = 0,
        visited = 0;
      const subtrees: (Element | ShadowRoot)[] = [element];
      for (let i = 0; i < subtrees.length && i < 40 && length < 32000; i++) {
        const root = subtrees[i]!;
        for (const host of [root, ...queryAll(root, "*").slice(0, 4000)])
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
            parent.closest("script,style,noscript,nav,aside,footer")
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
      queryAll(
        root,
        'shreddit-post,article,[role="article"],[data-testid="post-container"],main,[role="main"]',
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
    let pageBody = content ? textOf(content) : "";
    if (pageBody.length < 240) {
      const blocks = blockText();
      if (blocks.length > pageBody.length) pageBody = blocks;
    }
    const extra = siteSpecificText();
    if (extra) pageBody = `${pageBody}\n\n${extra}`.trim().slice(0, 14000);
    const wall = consentNote();
    if (wall) pageBody = `${wall}\n\n${pageBody}`.trim();
    const articleText = pageBody;
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
      videoTime: isYoutube ? undefined : video?.currentTime,
      transcript: [],
      transcriptStatus: isYoutube ? "unavailable" : "not-video",
    };
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
export function createInjectedPageReader(): (
  mode: CaptureMode,
  suppliedSelection: string,
) => Promise<Source | { captureError: string }> {
  // tsx/esbuild names nested functions with a `__name` helper that does not
  // exist in the page world. Define it inside the injected function.
  const body =
    "var __name = (target) => target;\nconst caps = (" +
    captionKit.toString() +
    ")();\nreturn (" +
    readPageSnapshot.toString() +
    ")(mode, suppliedSelection, caps);";
  return new Function("mode", "suppliedSelection", body) as (
    mode: CaptureMode,
    suppliedSelection: string,
  ) => Promise<Source | { captureError: string }>;
}
