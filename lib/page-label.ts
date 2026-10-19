import type { PageLabel } from "./suggestions";
import { hostOf } from "./suggestions";

export async function currentPageLabel(): Promise<PageLabel | undefined> {
  if (typeof chrome === "undefined" || !chrome.tabs || !chrome.windows || !chrome.storage?.session)
    return;
  try {
    const panel = await chrome.windows.getCurrent();
    const [tab] = await chrome.tabs.query({ active: true, windowId: panel.id });
    if (!tab || tab.windowId !== panel.id) return;
    const url = tab.url || tab.pendingUrl || "";
    if (!url) return;
    return { title: tab.title || "", url, host: hostOf(url) };
  } catch {
    return;
  }
}
