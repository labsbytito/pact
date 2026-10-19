export type PageLabel = { title: string; url: string; host: string };

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function siteLine(page?: PageLabel): string {
  if (!page?.host && !page?.title) return "Open a page, and Pact will meet you there.";
  const name = page.title?.trim() || page.host;
  return name ? `You’re on ${name}.` : "Open a page, and Pact will meet you there.";
}

export function askChips(page?: PageLabel): string[] {
  const host = page?.host ?? "";
  const title = (page?.title ?? "").toLowerCase();
  if (host.includes("youtube.com") || host === "youtu.be")
    return ["What did they just say?", "Save a note from this video", "What’s the useful part?"];
  if (host.includes("wikipedia.org"))
    return ["Give me the short version", "What should I actually visit?", "What’s still worth knowing?"];
  if (/museum|gallery/.test(host) || /museum|gallery/.test(title))
    return ["Plan a short visit", "What should I see first?", "How do I get there?"];
  if (host)
    return [`What’s worth keeping from ${host}?`, "Turn this into a next step", "What should I ask Fo?"];
  return ["Turn this into a next step", "What should I ask Fo?", "Help me decide"];
}
