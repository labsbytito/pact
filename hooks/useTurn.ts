import { useRef, useState } from "react";
import { AbortInterpretError, interpretLive, type TurnPrefs } from "../lib/api";
import { approveRequest, cancelPlan, loadRunByPlan, pollRun } from "../lib/backend";
import { makePact, message, now, uid, type Action, type Pact, type Source } from "../lib/model";
import { autoApprove } from "../lib/settings";

export type TurnPrefsLive = TurnPrefs & { signedOut?: boolean };

export function useTurn(save: (pact: Pact) => void) {
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [replyError, setReplyError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<number | null>(null);
  const approving = useRef(false);
  const latest = useRef(new Map<string, Pact>());
  const prefs = useRef<TurnPrefsLive>({});
  function remember(next: Pact) {
    latest.current.set(next.id, next);
    save(next);
    return next;
  }

  function stopPoll() {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }

  function watch(pact: Pact, runId: string) {
    stopPoll();
    const tick = async () => {
      try {
        const run = await pollRun(runId);
        const base = latest.current.get(pact.id) ?? pact;
        const previous = base.action;
        const owns =
          previous?.runId === runId ||
          ((previous?.status === "running" || previous?.status === "approved") && !previous.runId);
        if (!owns) return;
        const action: Action = {
          ...(previous ?? (pact.action as Action)),
          status: run.status === "running" ? "running" : run.status,
          result: run.result || run.error,
          progress: run.progress,
          runId,
        };
        const history = base.actions ?? [];
        remember({
          ...base,
          updatedAt: now(),
          action,
          actions:
            run.status === "running"
              ? history
              : [...history.filter((item) => item.id !== action.id), action],
        });
        if (run.status === "running") pollRef.current = window.setTimeout(() => void tick(), 3000);
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Pact lost the run status.");
      }
    };
    pollRef.current = window.setTimeout(() => void tick(), 400);
  }

  async function recover(pact: Pact) {
    const action = (latest.current.get(pact.id) ?? pact).action;
    if (!action?.planId || action.runId) return;
    if (action.status !== "approved" && action.status !== "running") return;
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
    } catch {
      /* No accepted run yet. Leave the request where it is. */
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
    if (!trimmed || streaming) return current;
    setNote("");
    setReplyError("");
    if (!reuseFailed) setDraft("");
    const created = !current;
    const tail = current?.messages.at(-1);
    const reuse = Boolean(reuseFailed && current && tail?.role === "assistant" && !tail.text.trim());
    const assistant = reuse ? { ...tail!, text: "", stopped: false } : message("assistant", "");
    const base = reuse
      ? { ...current!, messages: current!.messages.map((item) => item.id === assistant.id ? assistant : item), updatedAt: now(), source: current!.source ?? source }
      : current
        ? { ...current, messages: [...current.messages, message("user", trimmed)], updatedAt: now(), source: current.source ?? source }
        : makePact(trimmed, source);
    let pact = reuse ? remember(base) : remember({ ...base, messages: [...base.messages, assistant] });
    onReady?.(pact);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const result = await interpretLive(
        { ...pact, messages: pact.messages.filter((item) => item.text.trim()) },
        [],
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
      pact = remember({
        ...live,
        title: created && result.title ? result.title : live.title,
        messages: live.messages.map((item) => item.id === assistant.id ? { ...assistant } : item),
        action: action ?? (live.action?.status === "proposed" ? { ...live.action, status: "superseded" } : live.action),
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
    approving.current = true;
    setBusy(true);
    const requestId = action.requestId || uid();
    remember({ ...current, action: { ...action, requestId, status: "approved" }, updatedAt: now() });
    try {
      const run = await approveRequest({
        planId: action.planId,
        pactId: current.id,
        contextHash: action.contextHash,
        requestId,
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

  return { draft, setDraft, streaming, busy, note, setNote, replyError, send, approve, cancel, stop, watch, recover, prefs };
}
