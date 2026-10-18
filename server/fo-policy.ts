// Consequential Fo tools are opt-in in code. ask_fo and read-only get_*/list_*
// tools work by default. start_fo_call places a real phone call, and any tool
// Pact does not already know is treated the same way: it stays off unless
// PACT_FO_CONSEQUENTIAL=1, and even then approval must carry a separate confirmation.
const READ_ONLY = /^(?:get|list)_[a-z0-9_]+$/;

export type ToolDecision = "allow" | "confirm" | "deny";

export function consequentialToolsEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.PACT_FO_CONSEQUENTIAL === "1";
}

export function decideTool(name: string, consequentialEnabled: boolean): ToolDecision {
  if (name === "ask_fo" || READ_ONLY.test(name)) return "allow";
  return consequentialEnabled ? "confirm" : "deny";
}

// Returned text is safe to show. Undefined means the tool may be sent.
export function toolSendBlock(
  name: string,
  confirmed: boolean | undefined,
  consequentialEnabled: boolean,
) {
  const decision = decideTool(name, consequentialEnabled);
  if (decision === "allow") return;
  if (decision === "deny")
    return "This Fo action is turned off. It was not sent. Phone calls and unfamiliar tools stay off unless explicitly enabled.";
  if (confirmed !== true)
    return "This Fo action needs a separate confirmation before it can be sent. It was not sent.";
  return;
}
