/** The user asked for the action in their own words, so it does not wait for a second approval. */
export function userAskedToAct(text: string): boolean {
  const line = text.trim();
  if (!line || /^(plan|what|how|why|should|could|help me decide)\b/i.test(line)) return false;
  return (
    /\b(set up|setup|connect|disconnect|send this|send it|send the|ask fo|book|schedule)\b/i.test(line) ||
    /\bdo (this|that|it|my)\b/i.test(line)
  );
}
