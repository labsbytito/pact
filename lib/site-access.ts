import { pageAccess } from "./page-access";

export const SITE_ACCESS_DENIED =
  "Pact needs permission to read this site. Allow access, then try again.";

const COMPANION_ORIGINS = new Set([
  "http://127.0.0.1:4317/*",
  "http://localhost:4317/*",
  "http://127.0.0.1:3000/*",
  "http://localhost:3000/*",
]);

// One origin pattern, such as https://example.com/*. Paths are ignored by Chrome.
export function sitePatternFromUrl(
  url: string | undefined | null,
): string | undefined {
  if (!url || pageAccess(url) !== "web") return;
  try {
    return `${new URL(url).origin}/*`;
  } catch {
    return;
  }
}

type Memory = { tabId?: number; pattern?: string };
let remembered: Memory = {};

export function resetRememberedSite() {
  remembered = {};
}

export function rememberedSitePattern() {
  return remembered.pattern;
}

export function rememberInvocation(input: {
  tabId?: number;
  origin?: string;
  url?: string;
}) {
  if (input.url) {
    remembered = {
      tabId: input.tabId,
      pattern: sitePatternFromUrl(input.url),
    };
    return;
  }
  if (input.origin && sitePatternFromUrl(input.origin)) {
    remembered = { tabId: input.tabId, pattern: input.origin };
    return;
  }
  remembered = { tabId: input.tabId, pattern: undefined };
}

export function rememberObservedUrl(tabId: number, url: string) {
  if (remembered.tabId !== undefined && remembered.tabId !== tabId) return;
  const pattern = sitePatternFromUrl(url);
  if (pattern) remembered = { tabId, pattern };
  else if (pageAccess(url) === "restricted")
    remembered = { tabId, pattern: undefined };
}

// Invoke this directly from a side-panel click. permissions.request has to
// start in that gesture; an await before this call drops the gesture.
export function requestSiteRead(pattern: string | undefined): Promise<boolean> {
  if (
    !pattern ||
    typeof chrome === "undefined" ||
    !chrome.permissions?.request
  )
    return Promise.resolve(true);
  return chrome.permissions.request({ origins: [pattern] }).then(
    (granted) => granted,
    (error: unknown) => {
      const text = error instanceof Error ? error.message : "";
      if (/user gesture/i.test(text)) throw new Error(SITE_ACCESS_DENIED);
      throw error instanceof Error ? error : new Error(SITE_ACCESS_DENIED);
    },
  );
}

export async function listGrantedSites(): Promise<string[]> {
  if (typeof chrome === "undefined" || !chrome.permissions?.getAll) return [];
  const all = await chrome.permissions.getAll();
  return (all.origins ?? [])
    .filter(
      (origin) => !COMPANION_ORIGINS.has(origin) && !!sitePatternFromUrl(origin),
    )
    .sort();
}

export async function revokeGrantedSite(origin: string) {
  if (typeof chrome === "undefined" || !chrome.permissions?.remove) return;
  await chrome.permissions.remove({ origins: [origin] });
  if (remembered.pattern === origin)
    remembered = { ...remembered, pattern: undefined };
}
