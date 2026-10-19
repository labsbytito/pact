import type { PageLabel } from "./suggestions";
import { hostOf } from "./suggestions";

export async function currentPageLabel(): Promise<PageLabel | undefined> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.windows || !chrome.storage?.session)
    return;
  try {
    const panel = await chrome.windows.getCurrent();
    const stored = await chrome.storage.session.get([
      "pactInvocation",
      `pactInvocation:${panel.id}`,
    ]);
    const invocation = (stored[`pactInvocation:${panel.id}`] ?? stored.pactInvocation) as
      | { tabId?: number; windowId?: number }
      | undefined;
    if (!invocation?.windowId || invocation.windowId !== panel.id) return;
    const [tab] = await chrome.tabs.query({ active: true, windowId: invocation.windowId });
    if (!tab) return;
    const url = tab.url || tab.pendingUrl || "";
    if (!url || tab.id !== invocation.tabId) return;
    return { title: tab.title || "", url, host: hostOf(url) };
  } catch {
    return;
  }
}
