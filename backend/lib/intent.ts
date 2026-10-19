/** Research and connect asks can skip a second approval. Sending, booking, and questions cannot. */

const NEGATION = /\b(don't|dont|do not|never|not yet)\b/i;
const QUESTION_START = /^(who|what|when|where|why|how|should|can|could|would)\b/i;
const CONSEQUENTIAL = /\b(book|booking|schedule|scheduling|send|sending|message|email|pay|purchase|buy|call)\b/i;
const RESEARCH = /\b(find|look up|lookup|check)\b/i;
const CONNECT = /\b(connect|disconnect|set up|setup)\b/i;

export const FO_GUARD = "Do not book, contact, pay, or commit.";

export function userAskedToAct(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  if (NEGATION.test(line)) return false;
  if (line.endsWith("?") || QUESTION_START.test(line)) return false;
  if (CONSEQUENTIAL.test(line)) return false;
  return RESEARCH.test(line) || CONNECT.test(line);
}

export function qualifiesForBypass(input: {
  latest: string;
  toolName: string;
  message: string;
  consequential?: boolean;
  askBefore?: string;
}): boolean {
  if (input.askBefore === "always" || input.consequential || input.toolName !== "ask_fo") return false;
  if (input.message.trim() !== input.latest.trim()) return false;
  return userAskedToAct(input.latest);
}

export function guardMessage(message: string): string {
  const trimmed = message.trim();
  if (/do not book, contact, pay, or commit/i.test(trimmed)) return trimmed;
  return trimmed ? `${trimmed} ${FO_GUARD}` : FO_GUARD;
}
