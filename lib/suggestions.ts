export type PageLabel = { title: string; url: string; host: string };

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function bareAddress(value: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value === "localhost";
}

export function pageTitle(page?: PageLabel): string {
  const title = page?.title?.trim() ?? "";
  if (!title || bareAddress(title)) return "";
  return title;
}

export function siteLine(page?: PageLabel): string {
  const title = pageTitle(page);
  if (title) return `You’re on ${title}.`;
  if (page?.host && !bareAddress(page.host)) return `You’re on ${page.host}.`;
  return "Open a page, and Pact will meet you there.";
}

export function askChips(page?: PageLabel): string[] {
  const host = page?.host ?? "";
  const title = (page?.title ?? "").toLowerCase();
  if (host.includes("youtube.com") || host === "youtu.be")
    return ["What did they just say?", "Save a note from this video", "What’s the useful part?"];
  if (host.includes("wikipedia.org"))
    return ["Give me the short version", "What’s worth seeing?", "What should I still know?"];
  if (/museum|gallery/.test(host) || /museum|gallery/.test(title))
    return ["Plan a short visit", "What should I see first?", "How do I get there?"];
  if (host)
    return [`What’s worth keeping from ${host}?`, "Turn this into a next step", "What should I ask Fo?"];
  return ["Turn this into a next step", "What should I ask Fo?", "Help me decide"];
}
