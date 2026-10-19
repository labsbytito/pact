import { useRef, useState } from "react";
import { AbortInterpretError, interpretLive } from "../lib/api";
import { approveRequest, cancelPlan, pollRun } from "../lib/backend";
import { makePact, message, now, uid, type Action, type Pact, type Source } from "../lib/model";

export function useTurn(save: (pact: Pact) => void) {
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [note, setNote] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<number | null>(null);

  function stopPoll() {
    if (pollRef.current) window.clearTimeout(pollRef.current);
  }

  function watch(pact: Pact, runId: string) {
    stopPoll();
    const tick = async () => {
      try {
        const run = await pollRun(runId);
        const action: Action = {
          ...(pact.action as Action),
          status: run.status === "running" ? "running" : run.status,
          result: run.result,
          progress: run.progress,
          runId,
        };
        const history = pact.actions ?? [];
        const next: Pact = {
          ...pact,
          updatedAt: now(),
          action,
          actions: run.status === "running" ? history : [...history.filter((item) => item.id !== action.id), action],
        };
        save(next);
        pact = next;
        if (run.status === "running") pollRef.current = window.setTimeout(() => void tick(), 3000);
      } catch (error) {
        setNote(error instanceof Error ? error.message : "Pact lost the run status.");
      }
    };
    pollRef.current = window.setTimeout(() => void tick(), 400);
  }

  async function send(current: Pact | null, source: Source | undefined, text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return current;
    setNote("");
    setDraft("");
    const base = current
      ? { ...current, messages: [...current.messages, message("user", trimmed)], updatedAt: now(), source: current.source ?? source }
      : makePact(trimmed, source);
    const assistant = message("assistant", "");
    let pact: Pact = { ...base, messages: [...base.messages, assistant] };
    save(pact);
    setStreaming(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const result = await interpretLive(
        { ...pact, messages: pact.messages.filter((item) => item.text.trim()) },
        [],
        {
        signal: abort.signal,
        onDelta: (chunk) => {
          assistant.text += chunk;
          pact = { ...pact, messages: pact.messages.map((item) => item.id === assistant.id ? { ...assistant } : item) };
          save(pact);
        },
      });
      assistant.text = result.reply || assistant.text;
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
            status: "proposed",
          }
        : undefined;
      pact = {
        ...pact,
        title: result.title || pact.title,
        messages: pact.messages.map((item) => item.id === assistant.id ? { ...assistant } : item),
        action: action ?? (pact.action?.status === "proposed" ? { ...pact.action, status: "superseded" } : pact.action),
        updatedAt: now(),
      };
      save(pact);
      return pact;
    } catch (error) {
      if (error instanceof AbortInterpretError) {
        assistant.text = error.partial || assistant.text;
        assistant.stopped = true;
        pact = { ...pact, messages: pact.messages.map((item) => item.id === assistant.id ? { ...assistant } : item) };
        save(pact);
        return pact;
      }
      setNote(error instanceof Error ? error.message : "Pact could not reply.");
      return pact;
    } finally {
      setStreaming(false);
    }
  }

  async function approve(pact: Pact) {
    const action = pact.action;
    if (!action?.planId || action.status !== "proposed") return pact;
    const requestId = uid();
    let next: Pact = { ...pact, action: { ...action, status: "approved", runId: requestId }, updatedAt: now() };
    save(next);
    try {
      const run = await approveRequest({
        planId: action.planId,
        pactId: pact.id,
        contextHash: action.contextHash,
        requestId,
      });
      next = { ...next, action: { ...next.action!, status: "running", runId: run.runId, progress: "Asking Fo…" } };
      save(next);
      watch(next, run.runId);
      return next;
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Fo did not accept that request.");
      return next;
    }
  }

  async function cancel(pact: Pact) {
    const planId = pact.action?.planId;
    if (planId) await cancelPlan(planId).catch(() => {});
    if (!pact.action) return pact;
    const next = { ...pact, action: { ...pact.action, status: "superseded" as const } };
    save(next);
    return next;
  }

  function stop() { abortRef.current?.abort(); }

  return { draft, setDraft, streaming, note, setNote, send, approve, cancel, stop, watch };
}
