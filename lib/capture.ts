import type { Source } from "./model";
import { pageAccess } from "./page-access";
import { createInjectedPageReader, type CaptureMode } from "./page-reader";
export { pageAccess };
const readInjectedPage = createInjectedPageReader();
export type SelectionRequest = {
  id: string;
  tabId: number;
  windowId: number;
  url: string;
  text: string;
  at: number;
  frameId?: number;
};
const PROTECTED_PAGE =
  "Chrome protects this page. Open a normal webpage and click Pact’s toolbar icon.";
const PAGE_NOT_VISIBLE =
  "Click Pact’s toolbar icon on this page, then choose Read current page or Select item.";

function scriptingDenied(message: string) {
  return /cannot be scripted|extensions gallery|cannot access a chrome|cannot access (?:a |an )?edge:|chrome-extension:\/\//i.test(
    message,
  );
}

export function samePage(left: string, right: string) {
  try {
    const a = new URL(left),
      b = new URL(right);
    a.hash = "";
    b.hash = "";
    return a.href === b.href;
  } catch {
    return false;
  }
}
export function captureStillMatches(
  source: Pick<Source, "url">,
  tab: { id?: number; url?: string; active?: boolean },
  tabId: number,
) {
  return (
    tab.id === tabId &&
    tab.active === true &&
    !!tab.url &&
    samePage(source.url, tab.url)
  );
}
export async function pendingSelection(): Promise<
  SelectionRequest | undefined
> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
  const value = (await chrome.storage.session.get("pactSelection"))
    .pactSelection as SelectionRequest | undefined;
  return value && Date.now() - value.at < 120000 ? value : undefined;
}
export async function capturePage(
  mode: CaptureMode = "page",
  request?: SelectionRequest,
): Promise<Source> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting)
    throw new Error(
      "Page reading works inside the Pact Chrome extension. Open Pact from the toolbar beside the page you want to share.",
    );
  const panel = await chrome.windows.getCurrent();
  const stored = await chrome.storage.session.get([
    "pactInvocation",
    `pactInvocation:${panel.id}`,
  ]);
  const invocation = (stored[`pactInvocation:${panel.id}`] ??
    stored.pactInvocation) as { tabId: number; windowId: number } | undefined;
  if (invocation && invocation.windowId !== panel.id)
    throw new Error(
      "Click Pact’s toolbar icon in this window to share the page.",
    );
  if (!invocation)
    throw new Error("Click Pact’s toolbar icon on this page to share it.");
  const target = request ?? invocation;
  if (target.windowId !== panel.id)
    throw new Error(
      "That selection belongs to another window. Open Pact beside the selected page.",
    );
  if (request?.frameId)
    throw new Error(
      "This selection is inside an embedded frame. Open that content in its own tab, then share it with Pact.",
    );
  if (request && Date.now() - request.at > 120000)
    throw new Error("That selection expired. Select the text again.");
  const [tab] = await chrome.tabs.query({
    active: true,
    windowId: target.windowId,
  });
  if (tab?.id !== target.tabId)
    throw new Error(
      "The active tab changed. Click Pact’s toolbar icon on the page you want to share.",
    );
  // pendingUrl only fills in while the committed url is still empty (navigation).
  // A missing URL means this extension cannot see the page yet. That is an
  // unread site, separate from chrome:// and the Chrome Web Store.
  const address = tab.url || tab.pendingUrl || "";
  if (!address) throw new Error(PAGE_NOT_VISIBLE);
  if (pageAccess(address) === "restricted") throw new Error(PROTECTED_PAGE);
  if (request && !samePage(request.url, address))
    throw new Error("The selected page changed. Select the text again.");
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: target.tabId },
      world: "MAIN",
      func: readInjectedPage,
      args: [mode, request?.text ?? ""],
    });
    const value = results[0]?.result as
      Source | { captureError: string } | undefined;
    if (value && "captureError" in value) throw new Error(value.captureError);
    const source = value;
    if (!source) throw new Error("No page content was returned.");
    const [current] = await chrome.tabs.query({
      active: true,
      windowId: target.windowId,
    });
    if (!current || !captureStillMatches(source, current, target.tabId))
      throw new Error(
        "The tab or page changed while Pact was reading. Read the current page again.",
      );
    if (request && !samePage(request.url, source.url))
      throw new Error("The selected page changed. Select the text again.");
    if (request) await chrome.storage.session.remove("pactSelection");
    return { ...source, tabId: target.tabId, windowId: target.windowId };
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    if (
      /cancelled|timed out|changed|Highlight text|no readable text/.test(text)
    )
      throw new Error(text);
    if (scriptingDenied(text)) throw new Error(PROTECTED_PAGE);
    throw new Error(
      "Chrome could not read this page. Click Pact’s toolbar icon on this tab, then try Read current page again.",
    );
  }
}
