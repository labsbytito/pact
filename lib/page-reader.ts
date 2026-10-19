import type { CaptionApi } from "./captions";
import type { Source } from "./model";
import { pickPageElement } from "./page-reader-pick";
import { applyYoutubeCaptions } from "./page-reader-video";
export type CaptureMode = "page" | "selection" | "pick";
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
    if (mode === "pick") picked = await pickPageElement(blocked);
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
    await applyYoutubeCaptions(source, caps, initialUrl, isYoutube);
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
