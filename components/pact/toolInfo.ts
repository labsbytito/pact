export type ToolInfo = { name: string; group: string; can: string };

const known: Record<string, ToolInfo> = {
  ask_fo: { name: "Ask Fo", group: "Do things", can: "Sends a request to Fo, which can act in your connected services (email, calendar, calls, purchases) and reports back." },
  get_fo_reply: { name: "Check Fo's progress", group: "Do things", can: "Checks whether Fo has finished a request. Read-only." },
  start_fo_call: { name: "Start a voice call", group: "Talk", can: "Creates a one-time link to talk with Fo out loud. It expires after 10 minutes." },
  list_fo_conversations: { name: "List past conversations", group: "History", can: "Lists your earlier conversations with Fo on any channel. Read-only." },
  get_fo_conversation: { name: "Read a past conversation", group: "History", can: "Opens one earlier conversation with Fo. Read-only." },
};

export function toolInfo(name: string | undefined, description?: string): ToolInfo {
  const hit = name ? known[name] : undefined;
  if (hit) return hit;
  const label = (name || "tool").replace(/_/g, " ");
  return { name: label.charAt(0).toUpperCase() + label.slice(1), group: "Other", can: description?.trim() || "No description provided by Fo." };
}

export function summarize(text: string, max = 90) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
