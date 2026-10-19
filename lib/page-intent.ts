/** Only explicit requests to use the current page trigger a fresh capture. */
export function requestsCurrentPage(text: string): boolean {
  return /\b(?:this|current|the current)\s+(?:web\s*page|page|tab|video|article|website)\b/i.test(text)
    || /\b(?:read|summari[sz]e|explain)\s+(?:the\s+)?(?:page|webpage|video|article)(?:\s+(?:I(?:'m| am)\s+(?:on|watching|reading)|here))?\s*[.!?]?$/i.test(text);
}
