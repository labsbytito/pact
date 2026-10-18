import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capturePage,
  pendingSelection,
  type SelectionRequest,
} from "../lib/capture";
import type { Source } from "../lib/model";
const source: Source = {
  title: "Current post",
  url: "https://example.org/current",
  description: "",
  text: "Visible post text",
  selection: "",
  capturedAt: new Date().toISOString(),
  transcript: [],
  transcriptStatus: "not-video",
};

test("an injected cancellation envelope stays a cancellation rather than a permission error", async (t) => {
  const { chrome } = setup(t);
  chrome.scripting.executeScript = async () => [
    { result: { captureError: "Selection cancelled." } },
  ];
  await assert.rejects(capturePage("pick"), /^Error: Selection cancelled\.$/);
});
function setup(
  t: { after: (f: () => void) => void },
  options: {
    afterUrl?: string;
    afterId?: number;
    windowId?: number;
    selection?: SelectionRequest;
  } = {},
) {
  const original = (globalThis as any).chrome;
  let queries = 0,
    executions = 0,
    removed = false;
  const selected = { id: 4, windowId: 8, url: source.url, active: true };
  const chrome = {
    runtime: { id: "test" },
    windows: {
      async getCurrent() {
        return { id: options.windowId ?? 8 };
      },
    },
    storage: {
      session: {
        async get() {
          return {
            pactInvocation: { tabId: 4, windowId: 8 },
            pactSelection: options.selection,
          };
        },
        async remove() {
          removed = true;
        },
      },
    },
    tabs: {
      async query() {
        queries++;
        return [
          {
            ...selected,
            id: queries > 1 ? (options.afterId ?? 4) : 4,
            url: queries > 1 ? (options.afterUrl ?? source.url) : source.url,
          },
        ];
      },
    },
    scripting: {
      async executeScript(
        request: any,
      ): Promise<{ result: Source | { captureError: string } }[]> {
        executions++;
        assert.equal(request.target.tabId, 4);
        return [
          {
            result: {
              ...source,
              selection: request.args[1],
              captureMode: request.args[0],
            },
          },
        ];
      },
    },
  };
  (globalThis as any).chrome = chrome;
  t.after(() => {
    (globalThis as any).chrome = original;
  });
  return {
    chrome,
    get executions() {
      return executions;
    },
    get removed() {
      return removed;
    },
  };
}
test("a refresh captures the current invoked tab and binds source to its window", async (t) => {
  setup(t);
  const result = await capturePage();
  assert.equal(result.tabId, 4);
  assert.equal(result.windowId, 8);
  assert.equal(result.text, "Visible post text");
});
test("a navigation while reading is rejected instead of attaching stale context", async (t) => {
  setup(t, { afterUrl: "https://example.org/another-post" });
  await assert.rejects(capturePage(), /changed/);
});
test("a tab switch while reading is rejected even when both pages have the same URL", async (t) => {
  setup(t, { afterId: 9 });
  await assert.rejects(capturePage(), /changed/);
});
test("a panel in another window cannot read the last globally invoked tab", async (t) => {
  const state = setup(t, { windowId: 99 });
  await assert.rejects(capturePage(), /this window/);
  assert.equal(state.executions, 0);
});
test("context-menu selection is transferred exactly and consumed only after successful capture", async (t) => {
  const request: SelectionRequest = {
    id: "selection",
    tabId: 4,
    windowId: 8,
    url: source.url,
    text: "The particular item I selected",
    at: Date.now(),
  };
  const state = setup(t, { selection: request });
  const result = await capturePage("selection", request);
  assert.equal(result.selection, request.text);
  assert.equal(state.removed, true);
});
test("a selection from a previous SPA page is rejected before reading", async (t) => {
  const state = setup(t);
  await assert.rejects(
    capturePage("selection", {
      id: "s",
      tabId: 4,
      windowId: 8,
      url: "https://example.org/previous",
      text: "Old text",
      at: Date.now(),
    }),
    /selected page changed/,
  );
  assert.equal(state.executions, 0);
});
test("old selection handoffs cannot silently reappear when the panel reopens", async (t) => {
  const request: SelectionRequest = {
    id: "s",
    tabId: 4,
    windowId: 8,
    url: source.url,
    text: "Old text",
    at: Date.now() - 121000,
  };
  const state = setup(t, { selection: request });
  assert.equal(await pendingSelection(), undefined);
  await assert.rejects(capturePage("selection", request), /expired/);
  assert.equal(state.executions, 0);
});
test("the click-to-pick request uses the same guarded tab target", async (t) => {
  const { chrome } = setup(t);
  chrome.scripting.executeScript = async (request: any) => {
    assert.equal(request.args[0], "pick");
    return [
      {
        result: {
          ...source,
          selection: "Chosen post",
          captureMode: "picked" as any,
        },
      },
    ];
  };
  const result = await capturePage("pick");
  assert.equal(result.selection, "Chosen post");
});

test("per-window invocation wins over a newer invocation from another window", async (t) => {
  const { chrome } = setup(t);
  chrome.storage.session.get = async () => ({
    pactInvocation: { tabId: 50, windowId: 99 },
    "pactInvocation:8": { tabId: 4, windowId: 8 },
    pactSelection: undefined,
  });
  assert.equal((await capturePage()).tabId, 4);
});
test("embedded-frame selections fail explicitly instead of claiming the parent page as their source", async (t) => {
  const state = setup(t);
  await assert.rejects(
    capturePage("selection", {
      id: "frame",
      tabId: 4,
      windowId: 8,
      url: source.url,
      text: "Embedded content",
      at: Date.now(),
      frameId: 2,
    }),
    /embedded frame/,
  );
  assert.equal(state.executions, 0);
});
