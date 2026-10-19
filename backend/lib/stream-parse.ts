/** Pure helpers for streaming interpret replies. Kept beside the backend so route handlers do not import the extension bundle. */

export const PACT_STREAM_DELIM = "---pact---";

export function splitStreamReply(raw: string): { reply: string; meta?: unknown } {
  const idx = raw.indexOf(PACT_STREAM_DELIM);
  if (idx < 0) return { reply: raw.trimEnd() };
  const reply = raw.slice(0, idx).trimEnd();
  const tail = raw.slice(idx + PACT_STREAM_DELIM.length).trim();
  if (!tail) return { reply };
  try {
    const cleaned = tail.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return { reply };
    return { reply, meta: JSON.parse(cleaned.slice(start, end + 1)) };
  } catch {
    return { reply };
  }
}

export function streamReplyDelta(previousReplyLength: number, buffer: string) {
  const idx = buffer.indexOf(PACT_STREAM_DELIM);
  if (idx >= 0) {
    const reply = buffer.slice(0, idx);
    return { emit: reply.slice(previousReplyLength), replyLength: reply.length };
  }
  const hold = Math.min(PACT_STREAM_DELIM.length - 1, buffer.length);
  const safeEnd = buffer.length - hold;
  if (safeEnd <= previousReplyLength)
    return { emit: "", replyLength: previousReplyLength };
  return { emit: buffer.slice(previousReplyLength, safeEnd), replyLength: safeEnd };
}
