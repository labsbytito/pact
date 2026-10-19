/** Pure helpers for streaming interpret replies. No DOM / network. */

export const PACT_STREAM_DELIM = "---pact---";

/** Split streamed model output into visible reply + optional trailing JSON. */
export function splitStreamReply(raw: string): {
  reply: string;
  meta?: unknown;
} {
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

/**
 * Given previous emitted reply length and the full buffer so far, return any
 * new safe reply characters (holding back a possible delimiter prefix).
 */
export function streamReplyDelta(
  previousReplyLength: number,
  buffer: string,
): { emit: string; replyLength: number } {
  const idx = buffer.indexOf(PACT_STREAM_DELIM);
  if (idx >= 0) {
    const reply = buffer.slice(0, idx);
    const emit = reply.slice(previousReplyLength);
    return { emit, replyLength: reply.length };
  }
  // Hold back characters that could still form the start of the delimiter.
  const hold = Math.min(PACT_STREAM_DELIM.length - 1, buffer.length);
  const safeEnd = buffer.length - hold;
  if (safeEnd <= previousReplyLength)
    return { emit: "", replyLength: previousReplyLength };
  return {
    emit: buffer.slice(previousReplyLength, safeEnd),
    replyLength: safeEnd,
  };
}

/** Parse one SSE data payload line (without the leading "data: "). */
export function parseSseData(line: string): unknown {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "[DONE]") return null;
  return JSON.parse(trimmed);
}

/** Feed an SSE chunk buffer; return complete events and the remainder. */
export function consumeSseBuffer(buffer: string): {
  events: unknown[];
  rest: string;
} {
  const events: unknown[] = [];
  let rest = buffer;
  while (true) {
    const split = rest.indexOf("\n\n");
    if (split < 0) break;
    const block = rest.slice(0, split);
    rest = rest.slice(split + 2);
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trimStart();
      try {
        const parsed = parseSseData(payload);
        if (parsed !== null) events.push(parsed);
      } catch {
        /* ignore malformed frames */
      }
    }
  }
  return { events, rest };
}
