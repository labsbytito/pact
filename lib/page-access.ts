// Ordinary http(s) pages can be read once the user allows that site. Missing
// URLs, non-web schemes, and the Chrome Web Store are not readable: the store
// is https, but Chrome refuses extension scripts there.
export function pageAccess(
  url: string | undefined | null,
): "web" | "restricted" {
  if (!url) return "restricted";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "restricted";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return "restricted";
  const host = parsed.hostname.replace(/\.$/, "").toLowerCase();
  if (host === "chromewebstore.google.com") return "restricted";
  if (
    host === "chrome.google.com" &&
    /^\/webstore(?:\/|$)/i.test(parsed.pathname)
  )
    return "restricted";
  return "web";
}
