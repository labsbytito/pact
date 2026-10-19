import type { Attachment } from "../lib/attachments";
import type { PactCompanion } from "../lib/model";
import { useRef, useState } from "react";
import { AbortInterpretError, ApiError, interpretLive, type TurnPrefs } from "../lib/api";
import { approveRequest, cancelPlan, loadRunByPlan, pollRun } from "../lib/backend";
import { makePact, message, now, uid, type Action, type Pact, type Source } from "../lib/model";
import { autoApprove } from "../lib/settings";

export type TurnPrefsLive = TurnPrefs & { signedOut?: boolean };

export function useTurn(save: (pact: Pact) => void) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const companion = useRef<PactCompanion | undefined>(undefined);
  const busySend = useRef(false);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [replyError, setReplyError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef(new Map<string, number>());
  const approving = useRef(false);
  const sought = useRef(new Set<string>());
  const discarded = useRef(new Set<string>());
  const latest = useRef(new Map<string, Pact>());
  const prefs = useRef<TurnPrefsLive>({});
  function remember(next: Pact) {
    if (discarded.current.has(next.id)) return next;
    latest.current.set(next.id, next);
    save(next);
    return next;
  }

  function stopPoll(runId?: string) {
    if (!runId) {
      for (const timer of pollRef.current.values()) window.clearTimeout(timer);
      pollRef.current.clear();
      return;
    }
    const timer = pollRef.current.get(runId);
    if (timer) window.clearTimeout(timer);
    pollRef.current.delete(runId);
  }

  function ownedAction(base: Pact, runId: string) {
    if (base.action?.runId === runId) return base.action;
    const saved = (base.actions ?? []).find((item) => item.runId === runId);
    if (saved) return saved;
    if (base.action && !base.action.runId && (base.action.status === "running" || base.action.status === "approved"))
      return base.action;
    return undefined;
  }

  function watch(pact: Pact, runId: string) {
    stopPoll(runId);
    const tick = async () => {
      if (discarded.current.has(pact.id)) return;
      try {
        const run = await pollRun(runId);
        if (discarded.current.has(pact.id)) return;
        const base = latest.current.get(pact.id) ?? pact;
        const previous = ownedAction(base, runId);
        if (!previous) return;
        const action: Action = {
          ...previous,
          status: run.status === "running" ? "running" : run.status,
          result: run.result || run.error,
          progress: run.progress,
          runId,
        };
        const history = base.actions ?? [];
        const current = base.action?.id === action.id || base.action?.runId === runId;
        remember({
          ...base,
          updatedAt: now(),
          action: current ? action : base.action,
          actions:
            run.status === "running"
              ? history.map((item) => (item.id === action.id ? action : item))
              : [...history.filter((item) => item.id !== action.id), action],
        });
        if (run.status === "running") pollRef.current.set(runId, window.setTimeout(() => void tick(), 3000));
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Pact lost the run status.");
      }
    };
    pollRef.current.set(runId, window.setTimeout(() => void tick(), 400));
  }

  async function recover(pact: Pact) {
    if (approving.current) return;
    const action = (latest.current.get(pact.id) ?? pact).action;
    if (!action?.planId || action.runId || !action.requestId) return;
    if (action.status !== "approved" && action.status !== "running") return;
    if (sought.current.has(action.planId)) return;
    sought.current.add(action.planId);
    try {
      const run = await loadRunByPlan(action.planId);
      const base = latest.current.get(pact.id) ?? pact;
      const current = base.action;
      if (!run?.runId || !current || current.planId !== action.planId || current.runId) return;
      if (current.status !== "approved" && current.status !== "running") return;
      const next = remember({
        ...base,
        updatedAt: now(),
        action: {
          ...current,
          status: run.status === "running" ? "running" : run.status,
          runId: run.runId,
          result: run.result || run.error,
          progress: run.progress,
        },
      });
      if (run.status === "running") watch(next, run.runId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) return;
      const base = latest.current.get(pact.id) ?? pact;
      const current = base.action;
      if (!current || current.planId !== action.planId || current.runId) return;
      if (current.status !== "approved" && current.status !== "running") return;
      remember({
        ...base,
        updatedAt: now(),
        action: { ...current, status: "proposed", progress: undefined },
      });
    }
  }

  async function send(
    current: Pact | null,
    source: Source | undefined,
    text: string,
    onReady?: (pact: Pact) => void,
    reuseFailed = false,
  ) {
    const trimmed = text.trim();
    if ((!trimmed && !attachments.length) || busySend.current) return current;
    busySend.current = true;
    const files = reuseFailed ? current?.pendingAttachments ?? [] : attachments;
    const requestText = trimmed || "Please read the attached files.";
    setNote("");
    setReplyError("");
    if (!reuseFailed) setDraft("");
    const created = !current || current.messages.length === 0;
    const tail = current?.messages.at(-1);
    const reuse = Boolean(reuseFailed && current && tail?.role === "assistant" && !tail.text.trim());
    const assistant = reuse ? { ...tail!, text: "", stopped: false } : message("assistant", "");
    const base = reuse
      ? { ...current!, messages: current!.messages.map((item) => item.id === assistant.id ? assistant : item), updatedAt: now(), source: source ?? current!.source }
      : current
        ? { ...current, messages: [...current.messages, message("user", requestText)], updatedAt: now(), source: source ?? current.source }
        : makePact(requestText, source, [], companion.current);
    base.messages = [...base.messages];
    const lastUser = base.messages.findLastIndex((m) => m.role === "user");
    if (lastUser >= 0 && files.length) base.messages[lastUser] = { ...base.messages[lastUser]!, attachments: files };
    let pact = remember({ ...base, pendingAttachments: files, messages: reuse ? base.messages : [...base.messages, assistant] });
    if (!reuseFailed) setAttachments([]);
    onReady?.(pact);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const result = await interpretLive(
        { ...pact, messages: pact.messages.filter((item) => item.text.trim()) },
        files,
        {
          signal: abort.signal,
          prefs: { responseStyle: prefs.current.responseStyle, askBefore: prefs.current.askBefore },
          onDelta: (chunk) => {
            assistant.text += chunk;
            const live = latest.current.get(pact.id) ?? pact;
            pact = remember({
              ...live,
              messages: live.messages.map((item) => item.id === assistant.id ? { ...assistant } : item),
            });
          },
        },
      );
      if (discarded.current.has(pact.id)) return null;
      assistant.text = result.reply || assistant.text;
      const live = latest.current.get(pact.id) ?? pact;
      const action: Action | undefined = result.action
        ? {
            id: uid(),
            title: result.action.title,
            instruction: result.action.instruction,
            planId: result.action.planId,
            expiresAt: result.action.expiresAt,
            toolName: result.action.toolName,
            arguments: result.action.arguments,
            contextHash: result.action.contextHash,
            consequential: result.action.consequential,
            explicit: result.action.explicit,
            messageId: assistant.id,
            requestId: uid(),
            status: "proposed",
          }
        : undefined;
      const prior = live.action;
      const keepRunning = prior && (prior.status === "running" || prior.status === "approved") && prior.runId ? prior : undefined;
      const history = live.actions ?? [];
      pact = remember({
        ...live,
        title: created && live.titleSource !== "manual" && result.title ? result.title : live.title,
        pendingAttachments: undefined,
        messages: live.messages.map((item) => item.id === assistant.id ? { ...assistant } : item),
        action: action ?? (prior?.status === "proposed" ? { ...prior, status: "superseded" } : prior),
        actions: keepRunning && action ? [...history.filter((item) => item.id !== keepRunning.id), keepRunning] : history,
        updatedAt: now(),
      });
      if (autoApprove(pact.action?.explicit, prefs.current.askBefore, Boolean(prefs.current.signedOut)))
        void approve(pact);
      return pact;
    } catch (error) {
      if (error instanceof AbortInterpretError) {
        assistant.text = error.partial || assistant.text;
        assistant.stopped = true;
        const live = latest.current.get(pact.id) ?? pact;
        pact = remember({
          ...live,
          messages: live.messages.map((item) => item.id === assistant.id ? { ...assistant } : item),
        });
        return pact;
      }
      setReplyError(error instanceof Error ? error.message : "Pact couldn't finish that reply.");
      return latest.current.get(pact.id) ?? pact;
    } finally {
      setStreaming(false);
      busySend.current = false;
    }
  }

  async function approve(pact: Pact) {
    if (prefs.current.signedOut) {
      setNote("Connect Fo first");
      return latest.current.get(pact.id) ?? pact;
    }
    if (approving.current) return latest.current.get(pact.id) ?? pact;
    const current = latest.current.get(pact.id) ?? pact;
    const action = current.action;
    if (!action?.planId) return current;
    const retry = action.status === "proposed" || action.status === "failed" || (action.status === "approved" && Boolean(action.requestId));
    if (!retry) return current;
    sought.current.delete(action.planId);
    approving.current = true;
    setBusy(true);
    const requestId = action.status === "failed" ? uid() : action.requestId || uid();
    remember({ ...current, action: { ...action, requestId, status: "approved" }, updatedAt: now() });
    try {
      const run = await approveRequest({
        planId: action.planId,
        pactId: current.id,
        contextHash: action.contextHash,
        requestId,
        confirmConsequential: action.consequential === true,
      });
      const live = latest.current.get(current.id) ?? current;
      const next = remember({
        ...live,
        action: { ...live.action!, status: "running", runId: run.runId, requestId, progress: "Waiting for Fo" },
        updatedAt: now(),
      });
      watch(next, run.runId);
      return next;
    } catch (error) {
      const live = latest.current.get(current.id) ?? current;
      remember({
        ...live,
        action: {
          ...live.action!,
          status: "failed",
          requestId,
          result: error instanceof Error ? error.message : "Fo did not accept that request.",
        },
        updatedAt: now(),
      });
      setNote("");
      return latest.current.get(current.id) ?? current;
    } finally {
      approving.current = false;
      setBusy(false);
    }
  }

  async function cancel(pact: Pact) {
    const current = latest.current.get(pact.id) ?? pact;
    const planId = current.action?.planId;
    if (planId) await cancelPlan(planId).catch(() => {});
    if (!current.action) return current;
    return remember({ ...current, action: { ...current.action, status: "superseded" as const }, updatedAt: now() });
  }

  function stop() { abortRef.current?.abort(); }

  function reset() {
    abortRef.current?.abort(); stopPoll();
    for (const id of latest.current.keys()) discarded.current.add(id);
    latest.current.clear(); sought.current.clear();
    setAttachments([]); setDraft("");
  }

  return { reset, attachments, setAttachments, companion, draft, setDraft, streaming, busy, note, setNote, replyError, send, approve, cancel, stop, watch, recover, prefs };
}
