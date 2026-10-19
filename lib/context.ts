import type { Pact, Source, Action } from "./model";
import {
  wireAttachments,
  type Attachment,
} from "./attachments";
// Keep the complete local history; only send the context needed for this reply.
export function interpretationContext(
  pact: Pact,
  attachments: readonly Attachment[] = [],
  prefs?: { responseStyle?: "short" | "detailed"; askBefore?: "suggested" | "always" },
) {
  let source: Source | undefined;
  if (pact.source) {
    const s = pact.source;
    const nearby = s.transcript.filter(
      (x) => Math.abs(x.start - (s.videoTime ?? 0)) <= 120,
    );
    const broad = s.transcript.filter(
      (_, i) => i % Math.max(1, Math.ceil(s.transcript.length / 45)) === 0,
    );
    const candidates = [...nearby, ...broad];
    const unique = new Map<number, { start: number; text: string }>();
    let remaining = 40000;
    for (const line of candidates) {
      if (unique.has(line.start)) continue;
      const text = line.text.slice(0, 1000);
      if (text.length > remaining) break;
      unique.set(line.start, { start: line.start, text });
      remaining -= text.length;
    }
    source = {
      ...s,
      url: s.url.slice(0, 4000),
      viewportText: s.viewportText?.slice(0, 6000),
      selectionContext: s.selectionContext?.slice(0, 4000),
      selectionLabel: s.selectionLabel?.slice(0, 80),
      title: s.title.slice(0, 1000),
      description: s.description.slice(0, 4000),
      text: s.text.slice(0, s.description.startsWith("PDF ·") ? 22000 : 12000),
      selection: s.selection.slice(0, 4000),
      transcript: [...unique.values()].sort((a, b) => a.start - b.start),
      transcriptPartial:
        !!s.transcriptPartial ||
        unique.size < s.transcript.length ||
        candidates.some((line) => line.text.length > 1000),
    };
  }
  const recentFiles = pact.messages.slice(-24).flatMap((m) => m.attachments ?? []).slice(-3);
  const wired = wireAttachments(attachments.length ? attachments : recentFiles).slice(0, 3);
  const payload = {
    responseStyle: prefs?.responseStyle === "short" ? "short" as const : "detailed" as const,
    askBefore: prefs?.askBefore === "always" ? "always" as const : "suggested" as const,
    pact: {
      id: pact.id,
      intention: pact.intention.slice(0, 8000),
      source,
      messages: pact.messages
        .slice(-24)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 8000) })),
      attachments: wired,
    },
  };
  const targetBytes = Math.min(2_000_000, 240000 + new TextEncoder().encode(JSON.stringify(wired)).length);
  const bytes = () => new TextEncoder().encode(JSON.stringify(payload)).length;
  while (bytes() > targetBytes && payload.pact.messages.length > 1)
    payload.pact.messages.shift();
  if (bytes() > targetBytes && source) source.text = source.text.slice(0, 4000);
  while (bytes() > targetBytes && source && source.transcript.length) {
    const farthest = source.transcript.reduce(
      (best, line, i, all) =>
        Math.abs(line.start - (source!.videoTime ?? 0)) >
        Math.abs(all[best]!.start - (source!.videoTime ?? 0))
          ? i
          : best,
      0,
    );
    source.transcript.splice(farthest, 1);
    source.transcriptPartial = true;
  }
  if (source) {
    for (const key of [
      "description",
      "text",
      "selectionContext",
      "viewportText",
    ] as const) {
      while (bytes() > targetBytes && (source[key]?.length ?? 0) > 100) {
        source[key] = source[key]!.slice(
          0,
          Math.floor(source[key]!.length / 2),
        );
        source.pageTextPartial = true;
      }
    }
  }
  if (bytes() > 2_000_000) throw new Error("These files are too large together. Remove a file and send again.");
  return payload;
}
export function unresolved(action?: Action) {
  return !!action && ["approved", "running", "unknown"].includes(action.status);
}
export function supersedeProposal(pact: Pact): Pact {
  if (pact.action?.status !== "proposed") return pact;
  return {
    ...pact,
    action: undefined,
    actions: [
      ...(pact.actions ?? []),
      { ...pact.action, status: "superseded" },
    ],
  };
}
export function mergeReply(
  pact: Pact,
  result: {
    reply: string;
    title?: string;
    stopped?: boolean;
    action?: {
      title: string;
      instruction: string;
      planId: string;
      toolName: string;
      arguments: Record<string, unknown>;
      expiresAt?: string;
      consequential?: boolean;
    };
  },
  id: string,
  at: string,
): Pact {
  let next = {
    ...pact,
    title: pact.titleSource === "manual" ? pact.title : result.title ?? pact.title,
    messages: [
      ...pact.messages,
      {
        id,
        at,
        role: "assistant" as const,
        text: result.reply,
        ...(result.stopped ? { stopped: true } : {}),
      },
    ],
  };
  if (unresolved(pact.action)) return next;
  if (pact.action)
    next = {
      ...next,
      action: undefined,
      actions: [
        ...(pact.actions ?? []),
        {
          ...pact.action,
          status:
            pact.action.status === "proposed"
              ? "superseded"
              : pact.action.status,
        },
      ],
    };
  if (result.action)
    next = {
      ...next,
      action: { id: crypto.randomUUID(), ...result.action, status: "proposed" },
    };
  return next;
}
