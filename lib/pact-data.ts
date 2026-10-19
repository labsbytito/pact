import type { Pact, PactCompanion } from "./model";
export function migratePact(pact: Pact, fallback: PactCompanion): Pact {
  return { ...pact, companion: pact.companion ?? structuredClone(fallback) };
}
/** Companion choice is final. Updates from stale reply/poll snapshots keep user metadata. */
export function retainPactMetadata(previous: Pact | undefined, next: Pact): Pact {
  if (!previous) return next;
  if (previous.deletedAt) return { ...previous, action: next.action, actions: next.actions };
  return { ...next, companion: previous.companion ?? next.companion,
    ...(previous.titleSource === "manual" ? { title: previous.title, titleSource: "manual" as const } : {}),
    archived: previous.archived, pinned: previous.pinned, deletedAt: previous.deletedAt };
}
export function changePact(pact: Pact, command: "pin" | "archive" | "delete" | "rename", name?: string): Pact {
  if (command === "rename") return { ...pact, title: name?.trim().slice(0, 90) || pact.title, titleSource: "manual" };
  if (command === "pin") return { ...pact, pinned: !pact.pinned };
  if (command === "archive") return { ...pact, archived: !pact.archived };
  return { ...pact, deletedAt: new Date().toISOString(), pendingAttachments: undefined, messages: [], intention: "", source: undefined };
}
