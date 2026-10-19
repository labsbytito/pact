import type { Pact, PactCompanion } from "./model";
export function migratePact(pact: Pact, fallback: PactCompanion): Pact {
  return { ...pact, companion: pact.companion ?? structuredClone(fallback) };
}
/** Companion changes are explicit (changePact 'companion'); stale reply/poll snapshots never revert them. */
export function retainPactMetadata(previous: Pact | undefined, next: Pact): Pact {
  if (!previous) return next;
  if (previous.deletedAt) return { ...previous, action: next.action, actions: next.actions };
  return { ...next, companion: previous.companion ?? next.companion,
    ...(previous.titleSource === "manual" ? { title: previous.title, titleSource: "manual" as const } : {}),
    archived: previous.archived, pinned: previous.pinned, deletedAt: previous.deletedAt };
}
export function changePact(pact: Pact, command: "pin" | "archive" | "delete" | "rename" | "companion", arg?: string | PactCompanion): Pact {
  if (command === "companion") {
    if (!arg || typeof arg === "string") return pact;
    return { ...pact, companion: { name: arg.name.trim().slice(0, 40) || pact.companion?.name || "", appearance: { ...arg.appearance } } };
  }
  const name = typeof arg === "string" ? arg : undefined;
  if (command === "rename") return { ...pact, title: name?.trim().slice(0, 90) || pact.title, titleSource: "manual" };
  if (command === "pin") return { ...pact, pinned: !pact.pinned };
  if (command === "archive") return { ...pact, archived: !pact.archived };
  return { ...pact, deletedAt: new Date().toISOString(), pendingAttachments: undefined, messages: [], intention: "", source: undefined };
}
