import { test } from "node:test";
import assert from "node:assert/strict";
import { createInjectedPageReader } from "../lib/page-reader";

test("a late article is read from paragraphs when the viewport walk is empty", async (t) => {
  const previous = {
    document: globalThis.document,
    location: (globalThis as { location?: unknown }).location,
    window: (globalThis as { window?: unknown }).window,
    Element: (globalThis as { Element?: unknown }).Element,
    NodeFilter: (globalThis as { NodeFilter?: unknown }).NodeFilter,
    getComputedStyle: globalThis.getComputedStyle,
    innerHeight: (globalThis as { innerHeight?: number }).innerHeight,
    innerWidth: (globalThis as { innerWidth?: number }).innerWidth,
  };
  t.after(() => {
    Object.assign(globalThis, previous);
  });
  const paragraph = (text: string) => ({
    tagName: "P",
    id: "",
    className: "",
    textContent: text,
    children: [] as unknown[],
    parent: null as unknown,
    classList: { contains: () => false },
    getAttribute: () => null,
    closest: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    }),
  });
  const lead = paragraph(
    "The museum opens its north gallery on Friday with three new paintings.",
  );
  const body = {
    tagName: "BODY",
    id: "",
    className: "",
    textContent: lead.textContent,
    children: [lead],
    parent: null as unknown,
    classList: { contains: () => false },
    getAttribute: () => null,
    closest: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    }),
  };
  lead.parent = body;
  const doc: Record<string, unknown> = {
    title: "North gallery",
    body,
    documentElement: { lang: "en" },
    children: [body],
    scrollingElement: { scrollTop: 0, scrollHeight: 10 },
    createTreeWalker: () => ({ nextNode: () => null }),
    createElement: () => ({ style: {}, remove() {}, dataset: {} }),
    querySelector: (selector: string) =>
      (doc.querySelectorAll as (s: string) => unknown[])(selector)[0] ?? null,
    querySelectorAll: (selector: string) => {
      const parts = selector.split(",").map((part) => part.trim());
      const found: unknown[] = [];
      const walk = (node: { children?: unknown[] }) => {
        for (const child of node.children ?? []) {
          const el = child as { tagName?: string; children?: unknown[] };
          if (
            parts.some(
              (part) =>
                part === "p" && String(el.tagName).toUpperCase() === "P",
            )
          )
            found.push(child);
          walk(el);
        }
      };
      walk(doc as { children?: unknown[] });
      return found;
    },
  };
  body.parent = doc;
  Object.assign(globalThis, {
    document: doc,
    location: { href: "https://example.org/story", hostname: "example.org" },
    window: { getSelection: () => null },
    Element: class Element {},
    NodeFilter: { SHOW_TEXT: 4 },
    getComputedStyle: () => ({
      display: "block",
      visibility: "visible",
      opacity: "1",
    }),
    innerHeight: 800,
    innerWidth: 400,
  });
  const source = await createInjectedPageReader()("page", "");
  assert.equal("captureError" in source, false);
  if ("captureError" in source) return;
  assert.match(source.text, /north gallery/);
  assert.ok(source.text.length > 40);
});
