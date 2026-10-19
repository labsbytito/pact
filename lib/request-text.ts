const SAFETY = [
  /do not contact anyone, book anything, or spend money\.?/gi,
  /do not book, contact, pay, or commit\.?/gi,
];

/** The review shows the request plus one safety line. Fo still receives the full guarded text. */
export function visibleRequest(message: string): string {
  let kept = "";
  let text = message.trim();
  for (const pattern of SAFETY) {
    text = text.replace(pattern, (hit) => {
      if (!kept) kept = `${hit.trim().replace(/\.$/, "")}.`;
      return " ";
    });
  }
  const body = text.replace(/\s+/g, " ").trim();
  if (!kept) return body;
  return body ? `${body} ${kept}` : kept;
}
