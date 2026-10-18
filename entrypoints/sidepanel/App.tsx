import { supersedeProposal, mergeReply, unresolved } from "../../lib/context";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Plus,
  Settings as SettingsIcon,
  PanelLeft,
  Search,
  Link2,
  Mic,
  X,
  ChevronRight,
  Check,
  Globe,
  Archive,
  RotateCcw,
  Loader2,
  ExternalLink,
  Paperclip,
  AudioLines,
  ShieldCheck,
  MousePointer2,
} from "lucide-react";
import type { Action, Pact, Source, Settings } from "../../lib/model";
import {
  uid,
  now,
  message,
  makePact,
  safeUrl,
  timestamp,
  approve,
} from "../../lib/model";
import { read, write, readSync, writeSync } from "../../lib/storage";
import {
  capturePage,
  pendingSelection,
  type SelectionRequest,
} from "../../lib/capture";
import type { CaptureMode } from "../../lib/page-reader";
import { api, interpret, ApiError, type Health } from "../../lib/api";
import Companion from "./Companion";
import {
  withCharacterSeeds,
  DEFAULT_COMPANION,
  SHAPE_OPTIONS,
  COLOR_SWATCHES,
  SHAPES,
  normalizeCompanion,
  companionColorForScheme,
  companionSwatchName,
  type CompanionAppearance,
} from "../../lib/character";
// Render links as React nodes: captured/returned text never becomes HTML.
function LinkedText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let previous = 0;
  for (const match of text.matchAll(
    /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s<>"`]+)\)|https?:\/\/[^\s<>"`*]+/g,
  )) {
    const start = match.index!;
    if (match[1]) {
      nodes.push(
        text.slice(previous, start),
        <strong key={start}>
          <LinkedText text={match[1]} />
        </strong>,
      );
      previous = start + match[0].length;
      continue;
    }
    if (match[2] && match[3]) {
      const href = safeUrl(match[3]);
      if (href) {
        nodes.push(
          text.slice(previous, start),
          <a key={start} href={href} target="_blank" rel="noopener noreferrer">
            {match[2]}
          </a>,
        );
        previous = start + match[0].length;
        continue;
      }
    }
    let candidate = match[0].replace(/[.,;:!?]+$/, "");
    while (
      candidate.endsWith(")") &&
      (candidate.match(/\)/g)?.length ?? 0) >
        (candidate.match(/\(/g)?.length ?? 0)
    )
      candidate = candidate.slice(0, -1);
    while (candidate.endsWith("]") && !candidate.includes("["))
      candidate = candidate.slice(0, -1);
    const url = safeUrl(candidate);
    if (!url) continue;
    nodes.push(
      text.slice(previous, start),
      <a key={start} href={url} target="_blank" rel="noopener noreferrer">
        {candidate}
      </a>,
    );
    previous = start + candidate.length;
  }
  nodes.push(text.slice(previous));
  return <>{nodes}</>;
}
// An explicitly labelled excerpt, never a generated summary. Expanding restores the original verbatim.
function ReadableReply({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 600;
  const boundary = text.lastIndexOf(" ", 420);
  let end = boundary > 240 ? boundary : 420;
  // A clipped URL must never become a different, clickable source.
  for (const token of text.matchAll(
    /\[[^\]\n]+\]\(https?:\/\/[^\s<>]+\)|https?:\/\/[^\s<>]+/g,
  ))
    if (token.index! < end && token.index! + token[0].length > end)
      end = token.index!;
  const excerpt = text.slice(0, end).trimEnd();
  return (
    <>
      {long && !expanded && (
        <small className="reply-excerpt-label">Opening excerpt</small>
      )}
      <p>
        <LinkedText text={long && !expanded ? `${excerpt}…` : text} />
      </p>
      {long && (
        <button
          className="text-button reply-disclosure"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Read full reply"}
          <ChevronRight size={13} />
        </button>
      )}
    </>
  );
}
function RequestText({
  text,
  proposed = false,
}: {
  text: string;
  proposed?: boolean;
}) {
  if (proposed && text.length <= 220)
    return (
      <p>
        <LinkedText text={text} />
      </p>
    );
  return (
    <details className="request-details">
      <summary>{proposed ? "Request details" : "Original request"}</summary>
      <p>
        <LinkedText text={text} />
      </p>
    </details>
  );
}
const statusText = (a?: Action) =>
  !a
    ? "Conversation"
    : {
        proposed: "Ready for your review",
        approved: "Approved",
        running: "Fo is working",
        returned: "Fo replied",
        needs_answer: "Fo needs your answer",
        failed: "Needs attention",
        unknown: "Outcome needs checking",
        superseded: "Replaced by a newer intention",
      }[a.status];
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
const host = (s?: Source) => {
  try {
    return s ? new URL(s.url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};
export default function App() {
  const [pacts, setPacts] = useState<Pact[]>([]),
    [loaded, setLoaded] = useState(false),
    [settings, setSettings] = useState<Settings>({ onboarded: false });
  const [selected, setSelected] = useState<string>(),
    [view, setView] = useState<"chat" | "library">("chat"),
    [settingsOpen, setSettingsOpen] = useState(false),
    [sourceOpen, setSourceOpen] = useState(false),
    [reviewOpen, setReviewOpen] = useState(false),
    [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(""),
    [source, setSource] = useState<Source>(),
    [busy, setBusy] = useState(false),
    [capturing, setCapturing] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false),
    [listening, setListening] = useState(false),
    [health, setHealth] = useState<Health>({ ai: false, fo: false, tools: [] }),
    [companionOnline, setCompanionOnline] = useState(false),
    [connecting, setConnecting] = useState(false),
    [authUrl, setAuthUrl] = useState<string>(),
    [companion, setCompanion] = useState<CompanionAppearance>(DEFAULT_COMPANION),
    [draftCompanion, setDraftCompanion] =
      useState<CompanionAppearance>(DEFAULT_COMPANION),
    [darkScheme, setDarkScheme] = useState(
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  const dialog = useRef<HTMLElement>(null);
  const initialCaptureAllowed = useRef(true);
  const captureGeneration = useRef(0),
    handledSelection = useRef<string | undefined>(undefined);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("page");
  const [pageStale, setPageStale] = useState(false),
    [clock, setClock] = useState(Date.now());
  const composer = useRef<HTMLTextAreaElement>(null),
    end = useRef<HTMLDivElement>(null),
    pactsRef = useRef(pacts),
    speech = useRef<any>(null),
    writeQueue = useRef(Promise.resolve());
  const active = pacts.find((p) => p.id === selected);
  const currentSource = active ? active.source : source;
  const visible = pacts.filter(
    (p) =>
      !!p.archived === archived &&
      `${p.title} ${p.intention}`.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => setDarkScheme(media.matches);
    media.addEventListener("change", onScheme);
    return () => media.removeEventListener("change", onScheme);
  }, []);
  useEffect(() => {
    const accent = companionColorForScheme(companion.color, darkScheme);
    document.documentElement.style.setProperty("--companion", accent);
  }, [companion.color, darkScheme]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      read<Pact[]>("pacts", []),
      read<Settings>("settings", { onboarded: false }),
      read<string | null>("activePact", null),
      readSync<unknown>("companion", DEFAULT_COMPANION),
    ])
      .then(([stored, s, last, savedCompanion]) => {
        if (cancelled) return;
        const p = withCharacterSeeds(stored);
        setPacts(p);
        pactsRef.current = p;
        if (stored.some((item) => !item.characterSeed))
          void save(p).catch(() => {});
        setSettings(s);
        const appearance = normalizeCompanion(savedCompanion);
        setCompanion(appearance);
        setDraftCompanion(appearance);
        if (last && p.some((item) => item.id === last && !item.archived))
          setSelected(last);
        setLoaded(true);
        // Only the initial toolbar invocation, in the actual extension, reads a tab.
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime?.id &&
          initialCaptureAllowed.current
        ) {
          setCapturing(true);
          void pendingSelection()
            .then(async (request) => {
              const window = await chrome.windows.getCurrent();
              if (request && request.windowId === window.id) {
                if (handledSelection.current === request.id) return;
                handledSelection.current = request.id;
              }
              return capturePage(
                request?.windowId === window.id ? "selection" : "page",
                request?.windowId === window.id ? request : undefined,
              );
            })
            .then((page) => {
              if (page && !cancelled && initialCaptureAllowed.current) {
                setSource(page);
                setPageStale(false);
                setClock(Date.now());
              }
            })
            .catch(() => {})
            .finally(() => {
              if (!cancelled) setCapturing(false);
            });
        }
      })
      .catch((e) => setError(errorText(e)));
    return () => {
      cancelled = true;
      speech.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (loaded) void write("activePact", selected ?? null).catch(() => {});
  }, [selected, loaded]);
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
    const invoked = (event: {
      type?: string;
      windowId?: number;
      selection?: SelectionRequest;
    }) => {
      if (event.type !== "pact-invocation" && event.type !== "pact-selection")
        return;
      void chrome.windows.getCurrent().then((window) => {
        const targetWindow = event.selection?.windowId ?? event.windowId;
        if (targetWindow !== window.id) return;
        if (event.selection) {
          if (handledSelection.current === event.selection.id) return;
          handledSelection.current = event.selection.id;
          const generation = ++captureGeneration.current;
          initialCaptureAllowed.current = false;
          setCapturing(true);
          setError("");
          void capturePage("selection", event.selection)
            .then((page) => {
              if (generation !== captureGeneration.current) return;
              setSelected(undefined);
              setView("chat");
              setSource(page);
              setDraft("");
              setPageStale(false);
              setClock(Date.now());
            })
            .catch((e) => setError(errorText(e)))
            .finally(() => setCapturing(false));
        } else void capture("page");
      });
    };
    chrome.runtime.onMessage.addListener(invoked);
    return () => chrome.runtime.onMessage.removeListener(invoked);
  }, [selected]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30000);
    if (typeof chrome === "undefined" || !chrome.runtime?.id)
      return () => clearInterval(timer);
    const activate = (info: { tabId: number; windowId: number }) => {
      if (
        currentSource?.windowId === info.windowId &&
        currentSource?.tabId !== info.tabId
      )
        setPageStale(true);
    };
    const changed = (id: number, info: { url?: string; status?: string }) => {
      if (
        currentSource?.tabId === id &&
        (info.url || info.status === "loading")
      )
        setPageStale(true);
    };
    chrome.tabs.onActivated.addListener(activate);
    chrome.tabs.onUpdated.addListener(changed);
    return () => {
      clearInterval(timer);
      chrome.tabs.onActivated.removeListener(activate);
      chrome.tabs.onUpdated.removeListener(changed);
    };
  }, [
    currentSource?.tabId,
    currentSource?.windowId,
    currentSource?.capturedAt,
  ]);
  async function refreshHealth() {
    try {
      setHealth(await api<Health>("/health"));
      setCompanionOnline(true);
    } catch {
      setCompanionOnline(false);
    }
  }
  useEffect(() => {
    void refreshHealth();
    const timer = setInterval(refreshHealth, 10000);
    const focus = () => void refreshHealth();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [active?.messages.length, busy, active?.action?.status]);
  useEffect(() => {
    const t = composer.current;
    if (t) {
      t.style.height = "auto";
      t.style.height = Math.min(t.scrollHeight, 160) + "px";
    }
  }, [draft]);
  async function save(next: Pact[]) {
    pactsRef.current = next;
    setPacts(next);
    writeQueue.current = writeQueue.current
      .catch(() => {})
      .then(() => write("pacts", next));
    try {
      await writeQueue.current;
    } catch {
      setError(
        "Pact could not save to this browser. Keep this window open and try again.",
      );
      throw new Error("Storage is unavailable.");
    }
  }
  async function update(p: Pact) {
    await save(
      pactsRef.current.map((x) =>
        x.id === p.id ? { ...p, updatedAt: now() } : x,
      ),
    );
  }
  async function onboard() {
    const s = { onboarded: true };
    setSettings(s);
    await write("settings", s);
  }
  function newPact() {
    initialCaptureAllowed.current = false;
    captureGeneration.current++;
    setCapturing(false);
    setPageStale(false);
    setSelected(undefined);
    setView("chat");
    setSource(undefined);
    setDraft("");
    setError("");
    composer.current?.focus();
  }
  function openPact(p: Pact) {
    initialCaptureAllowed.current = false;
    captureGeneration.current++;
    setCapturing(false);
    setPageStale(false);
    setSelected(p.id);
    setView("chat");
    setDraft("");
    setError("");
  }
  async function capture(mode: CaptureMode = "page") {
    initialCaptureAllowed.current = false;
    const generation = ++captureGeneration.current,
      targetId = selected;
    setCaptureMode(mode);
    setCapturing(true);
    setError("");
    try {
      const page = await capturePage(mode);
      if (generation !== captureGeneration.current) return;
      if (targetId) {
        const latest = pactsRef.current.find((p) => p.id === targetId);
        if (latest) {
          if (latest.action?.status === "proposed" && latest.action.planId)
            await api("/actions/cancel", {
              planId: latest.action.planId,
            }).catch(() => {});
          const current =
            pactsRef.current.find((p) => p.id === targetId) ?? latest;
          await update({ ...supersedeProposal(current), source: page });
        }
      } else setSource(page);
      setPageStale(false);
      setClock(Date.now());
    } catch (e) {
      if (generation === captureGeneration.current)
        setError(
          /^Selection cancelled/i.test(errorText(e)) ? "" : errorText(e),
        );
    } finally {
      if (generation === captureGeneration.current) setCapturing(false);
    }
  }
  const captureAge = currentSource
    ? Math.max(
        0,
        Math.floor((clock - Date.parse(currentSource.capturedAt)) / 60000),
      )
    : 0;
  const captureLabel = pageStale
    ? "Page changed · refresh to share it"
    : captureAge > 0
      ? `Read ${captureAge} min ago · saved snapshot`
      : "Read just now · saved snapshot";
  async function send() {
    if (!draft.trim() || busy || capturing) return;
    initialCaptureAllowed.current = false;
    setBusy(true);
    setError("");
    const text = draft.trim();
    setDraft("");
    let p: Pact;
    try {
      if (active?.action?.status === "proposed" && active.action.planId) {
        await api("/actions/cancel", { planId: active.action.planId }).catch(
          () => {},
        );
      }
      const base = active ? supersedeProposal(active) : undefined;
      p = base
        ? { ...base, messages: [...base.messages, message("user", text)] }
        : makePact(text, source, pactsRef.current);
      if (active) await update(p);
      else {
        await save([p, ...pactsRef.current]);
        setSelected(p.id);
      }
      setView("chat");
      await onboard();
      try {
        const result = await interpret(p);
        const latest = pactsRef.current.find((x) => x.id === p.id) ?? p;
        await update(mergeReply(latest, result, uid(), now()));
        await refreshHealth();
      } catch (e) {
        setError(errorText(e));
      }
    } catch (e) {
      setDraft(text);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function retryAI() {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await interpret(active);
      const latest = pactsRef.current.find((p) => p.id === active.id);
      if (latest) await update(mergeReply(latest, result, uid(), now()));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function connectFo() {
    setConnecting(true);
    setError("");
    try {
      const result = await api<{ url?: string; connected?: boolean }>(
        "/fo/connect",
        {},
      );
      if (result.url) {
        const u = new URL(result.url);
        if (u.origin !== "https://mcp.api.wajo.ai")
          throw new Error("Unexpected Wajo connection address.");
        setAuthUrl(result.url);
        setSettingsOpen(true);
      }
      await onboard();
      await refreshHealth();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setConnecting(false);
    }
  }
  async function execute() {
    if (!active?.action || !active.action.planId) return;
    const pact = active;
    setReviewOpen(false);
    setError("");
    setBusy(true);
    try {
      const action = approve(pact.action!);
      await update({ ...pact, action });
      const result = await api<{ runId: string }>("/actions/approve", {
        planId: action.planId,
      });
      await update({
        ...pact,
        action: { ...action, status: "running", runId: result.runId },
      });
    } catch (e) {
      await update({
        ...pact,
        action: {
          ...pact.action!,
          status:
            e instanceof ApiError && e.status < 500 ? "failed" : "approved",
          result:
            e instanceof ApiError && e.status < 500
              ? errorText(e)
              : "Delivery is uncertain. Pact will check the original request. Do not submit it again.",
        },
      });
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    const running = pacts.filter(
      (p) =>
        p.action &&
        (p.action.status === "running" || p.action.status === "approved") &&
        p.action.planId,
    );
    if (!running.length) return;
    async function poll() {
      for (const p of running) {
        try {
          const run = await api<{
            runId: string;
            status:
              "running" | "returned" | "needs_answer" | "failed" | "unknown";
            result?: string;
            error?: string;
            progress?: string;
          }>(
            p.action!.runId
              ? `/actions/${p.action!.runId}`
              : `/actions/by-plan/${p.action!.planId}`,
          );
          if (!cancelled) {
            const latest = pactsRef.current.find((x) => x.id === p.id);
            if (
              latest &&
              latest.action &&
              latest.action.id === p.action?.id &&
              (latest.action.status !== run.status ||
                latest.action.runId !== run.runId ||
                latest.action.result !== (run.result ?? run.error) ||
                latest.action.progress !== run.progress)
            )
              await update({
                ...latest,
                action: {
                  ...latest.action,
                  status: run.status,
                  runId: run.runId,
                  result: run.result ?? run.error,
                  progress: run.progress,
                },
              });
          }
        } catch (e) {
          if (!cancelled && e instanceof ApiError && e.status === 404) {
            const latest = pactsRef.current.find((x) => x.id === p.id);
            if (latest?.action?.id === p.action?.id && latest?.action)
              await update({
                ...latest,
                action: {
                  ...latest.action,
                  status: "unknown",
                  progress: undefined,
                  result:
                    "Pact could not find the original run. Check your Fo activity before requesting this action again.",
                },
              });
          } else if (!cancelled) setError(errorText(e));
        }
      }
    }
    void poll();
    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    pacts
      .map((p) => `${p.id}:${p.action?.status}:${p.action?.runId}`)
      .join("|"),
  ]);
  function dictate() {
    const Speech =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setError(
        "Dictation isn’t available in this browser. You can always type your message.",
      );
      return;
    }
    if (listening) {
      speech.current?.stop();
      return;
    }
    const recognition = new Speech();
    recognition.lang = navigator.language;
    recognition.interimResults = false;
    recognition.onresult = (e: any) =>
      setDraft((d) => `${d}${d ? " " : ""}${e.results[0][0].transcript}`);
    recognition.onerror = () => {
      setError(
        "Dictation couldn’t start. Check microphone access, or type your message.",
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    speech.current = recognition;
    recognition.start();
    setListening(true);
  }
  function sourceLink(s: Source, time?: number) {
    const url = safeUrl(s.url);
    if (!url) return "#";
    const u = new URL(url);
    if (time !== undefined) u.searchParams.set("t", String(Math.floor(time)));
    return u.href;
  }
  const closeDialog = () => {
    setSettingsOpen(false);
    setSourceOpen(false);
    setReviewOpen(false);
    if (editorOpen) {
      setDraftCompanion(companion);
      setEditorOpen(false);
    }
  };
  function openCompanionEditor() {
    setDraftCompanion(companion);
    setSettingsOpen(false);
    setSourceOpen(false);
    setReviewOpen(false);
    setEditorOpen(true);
  }
  async function saveCompanion() {
    const next = normalizeCompanion(draftCompanion);
    setCompanion(next);
    setDraftCompanion(next);
    setEditorOpen(false);
    try {
      await writeSync("companion", next);
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") closeDialog();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (!loaded)
    return (
      <div className="boot">
        <Companion appearance={companion} dark={darkScheme} thinking />
        <p>Finding your Pacts…</p>
      </div>
    );
  return (
    <div className={`app-shell${active && view === "chat" ? " in-thread" : ""}`}>
      <aside className="sidebar">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            newPact();
          }}
        >
          <Companion appearance={companion} dark={darkScheme} size="small" />
          <span>
            pact<span className="wordmark-dot">.</span>
          </span>
        </a>
        <button className="new-button" onClick={newPact}>
          <Plus size={18} /> New Pact
        </button>
        <button
          className={`sidebar-nav ${view === "library" ? "chosen" : ""}`}
          onClick={() => setView("library")}
        >
          <PanelLeft size={18} /> My Pacts{" "}
          <span>{pacts.filter((p) => !p.archived).length}</span>
        </button>
        <label className="sidebar-search">
          <Search size={15} />
          <input
            aria-label="Search conversations"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="recent-label">Recent</p>
        <div className="recent-list">
          {pacts
            .filter(
              (p) =>
                !p.archived &&
                `${p.title} ${p.intention}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .slice(0, 30)
            .map((p, i) => (
              <button
                key={p.id}
                className={`recent ${selected === p.id && view === "chat" ? "selected" : ""}`}
                onClick={() => openPact(p)}
              >
                <span className={`thread-avatar tone-${i % 4}`}>
                  <Companion seed={p.characterSeed ?? p.id} size="small" />
                </span>
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    {p.action && unresolved(p.action)
                      ? statusText(p.action)
                      : (p.messages.at(-1)?.text ?? p.intention)}
                  </small>
                </span>
                {p.action?.status === "running" && (
                  <span className="status-light" />
                )}
              </button>
            ))}
          {!pacts.filter((p) => !p.archived).length && (
            <p className="quiet-empty">Your conversations will appear here.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="private-note">
            <ShieldCheck size={16} />
            <span>Saved on this device</span>
          </div>
          <button
            className="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            <span className="profile">
              <SettingsIcon size={17} />
            </span>
            <span>
              Settings<small>Connections &amp; preferences</small>
            </span>
            <SettingsIcon size={17} />
          </button>
        </div>
      </aside>
      <main className="main-pane">
        <header className="topbar">
          <button
            className="mobile-brand"
            onClick={newPact}
            aria-label="New Pact"
            title="New Pact"
          >
            <Companion
              seed={
                view === "chat"
                  ? active?.characterSeed ?? active?.id
                  : undefined
              }
              appearance={companion}
              dark={darkScheme}
              size="tiny"
            />
            <span>pact.</span>
          </button>
          <div className="topbar-title">
            {active && view === "chat" ? (
              <>
                <span className="header-avatar">
                  <Companion
                    seed={active.characterSeed ?? active.id}
                    size="small"
                  />
                </span>
                <span>
                  {active.title}
                  <small>{host(active.source) || "Pact conversation"}</small>
                </span>
              </>
            ) : (
              <span className="topbar-greeting">
                {view === "library" ? "My Pacts" : "Pact"}
                <small>
                  {view === "library"
                    ? "Your saved conversations"
                    : "Your companion on the web"}
                </small>
              </span>
            )}
          </div>
          <div className="header-actions">
            <button
              className={`icon-button mobile-only ${view === "library" ? "active" : ""}`}
              title="My Pacts"
              aria-label="My Pacts"
              onClick={() => setView(view === "library" ? "chat" : "library")}
            >
              <PanelLeft size={19} />
            </button>
            <button
              className="icon-button"
              title="New Pact"
              aria-label="New Pact"
              onClick={newPact}
            >
              <Plus size={20} />
            </button>
            <button
              className="icon-button"
              title="Settings"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon size={19} />
            </button>
          </div>
        </header>
        {view === "library" ? (
          <section className="library">
            <h1>My Pacts</h1>
            <p>Pick up where you left off.</p>
            <div className="library-controls">
              <label className="search-box">
                <Search size={18} />
                <input
                  aria-label="Search Pacts"
                  placeholder="Search conversations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                className={archived ? "text-button active" : "text-button"}
                onClick={() => setArchived(!archived)}
              >
                <Archive size={17} />
                {archived ? "Archived" : "Archive"}
              </button>
            </div>
            <div className="pact-grid">
              {visible.map((p, i) => (
                <button
                  className="pact-tile"
                  key={p.id}
                  onClick={() => openPact(p)}
                >
                  <span className={`tile-avatar tone-${i % 4}`}>
                    <Companion seed={p.characterSeed ?? p.id} size="normal" />
                  </span>
                  <span className="tile-copy">
                    <span className="tile-heading">
                      <strong>{p.title}</strong>
                      <time>
                        {new Date(p.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </span>
                    <span className="tile-preview">
                      {p.messages.at(-1)?.text ?? p.intention}
                    </span>
                    <span className="tile-footer">
                      {host(p.source) || statusText(p.action)}
                      {p.action && unresolved(p.action) && (
                        <span className="run-label">
                          {statusText(p.action)}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            {!visible.length && (
              <div className="library-empty">
                <Companion
                  appearance={companion}
                  dark={darkScheme}
                  size="normal"
                />
                <h2>
                  {search
                    ? "No matching conversations"
                    : archived
                      ? "No archived Pacts"
                      : "Your Pacts live here"}
                </h2>
                <p>
                  {search
                    ? "Try a different word."
                    : archived
                      ? "Archived Pacts will appear here."
                      : "Start a conversation. Come back to it anytime."}
                </p>
                <button className="primary" onClick={newPact}>
                  <Plus size={17} /> Make a Pact
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <div className="conversation-scroll">
              <div
                className={`conversation ${active ? "has-thread" : "is-empty"}`}
              >
                {!active ? (
                  <section className="welcome">
                    <div className="hello">
                      <Companion
                        appearance={companion}
                        dark={darkScheme}
                        size="hero"
                      />
                      <div className="hello-copy">
                        <h1>What should we get done on this page?</h1>
                        <p>Bring me a page, or just a thought.</p>
                        <button
                          className="hello-edit text-button"
                          onClick={openCompanionEditor}
                        >
                          Customize companion
                        </button>
                      </div>
                    </div>
                    <button
                      className={`capture-card ${currentSource ? "captured" : ""}`}
                      onClick={() =>
                        currentSource ? setSourceOpen(true) : void capture()
                      }
                      disabled={capturing}
                    >
                      <span className="capture-icon">
                        {capturing ? (
                          <Loader2 size={21} className="spin" />
                        ) : currentSource ? (
                          <Globe size={21} />
                        ) : (
                          <Link2 size={21} />
                        )}
                      </span>
                      <span>
                        <strong>
                          {capturing
                            ? "Reading this page…"
                            : currentSource
                              ? currentSource.title
                              : "Read the page I’m on"}
                        </strong>
                        <small>
                          {currentSource
                            ? `${host(currentSource)}${currentSource.videoTime !== undefined ? ` · ${timestamp(currentSource.videoTime)}` : ""}`
                            : "A video, a post, an article. Start anywhere."}
                        </small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                    {currentSource ? (
                      <div
                        className="suggestions"
                        aria-label="Ways to use this page"
                      >
                        {(
                          [
                            [
                              "Help me understand this page.",
                              "Read this page",
                            ],
                            [
                              "Help me turn what caught my attention on this page into a practical next step.",
                              "Plan next step",
                            ],
                          ] as const
                        ).map(([prompt, label]) => (
                          <button
                            key={label}
                            onClick={() => {
                              setDraft(prompt);
                              composer.current?.focus();
                            }}
                          >
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="welcome-hint">
                        Or start a conversation below.
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="thread" aria-label="Pact conversation">
                    <div className="thread-date">
                      {new Date(active.createdAt).toLocaleDateString(
                        undefined,
                        { weekday: "long", month: "short", day: "numeric" },
                      )}
                    </div>
                    {active.source && (
                      <button
                        className="source-pill"
                        onClick={() => setSourceOpen(true)}
                      >
                        <Globe size={15} />
                        <span>
                          {host(active.source)}
                          {active.source.videoTime !== undefined
                            ? ` · ${timestamp(active.source.videoTime)}`
                            : ""}
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                    {active.messages.map((m) => (
                      <div key={m.id} className={`message-row ${m.role}`}>
                        <div className="message">
                          {m.role === "assistant" ? (
                            <ReadableReply text={m.text} />
                          ) : (
                            <p>{m.text}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {busy && (
                      <div className="message-row assistant">
                        <div className="thinking-bubble" role="status">
                          Thinking…
                        </div>
                      </div>
                    )}
                    {active.action && (
                      <article className="action-card">
                        <div className="action-eyebrow">
                          <span
                            className={`status-light ${active.action.status === "failed" ? "attention" : ""}`}
                          />
                          {statusText(active.action)}
                        </div>
                        <h2>{active.action.title}</h2>
                        <RequestText
                          text={active.action.instruction}
                          proposed={active.action.status === "proposed"}
                        />
                        {active.action.status === "proposed" && (
                          <>
                            <button
                              className="primary"
                              onClick={() =>
                                active.action?.expiresAt &&
                                Date.parse(active.action.expiresAt) < Date.now()
                                  ? void retryAI()
                                  : health.fo
                                    ? setReviewOpen(true)
                                    : setSettingsOpen(true)
                              }
                            >
                              {active.action.expiresAt &&
                              Date.parse(active.action.expiresAt) < Date.now()
                                ? "Refresh next step"
                                : health.fo
                                  ? "Review next step"
                                  : "Connect Fo to continue"}
                              <ArrowUpRight size={18} />
                            </button>
                          </>
                        )}
                        {(active.action.status === "running" ||
                          active.action.status === "approved") && (
                          <div className="action-assurance">
                            <Loader2 size={15} className="spin" />{" "}
                            {active.action.progress ??
                              "Waiting for Fo’s actual response…"}
                          </div>
                        )}
                        {active.action.status === "needs_answer" && (
                          <p>Reply below to continue.</p>
                        )}
                        {active.action.status === "unknown" && (
                          <p>
                            Fo may have acted before the companion was
                            interrupted. Check your Fo activity before
                            requesting the action again.
                          </p>
                        )}
                        {active.action.result && (
                          <div className="result">
                            <strong>
                              {active.action.status === "failed"
                                ? "Needs attention"
                                : active.action.status === "needs_answer"
                                  ? "Fo needs your answer"
                                  : "Response from Fo"}
                            </strong>
                            {active.action.status === "needs_answer" ? (
                              <p>
                                <LinkedText text={active.action.result} />
                              </p>
                            ) : (
                              <ReadableReply text={active.action.result} />
                            )}
                          </div>
                        )}
                        {active.action.status === "needs_answer" && (
                          <button
                            className="secondary"
                            onClick={() => composer.current?.focus()}
                          >
                            Answer Fo
                            <ArrowUpRight size={15} />
                          </button>
                        )}
                      </article>
                    )}
                    {active.actions?.length ? (
                      <details className="action-history">
                        <summary>
                          Earlier steps · {active.actions.length}
                        </summary>
                        {active.actions.map((a) => (
                          <article key={a.id} className="action-card">
                            <div className="action-eyebrow">
                              {statusText(a)}
                            </div>
                            <h2>{a.title}</h2>
                            <RequestText text={a.instruction} />
                            {a.result && (
                              <div className="result">
                                <ReadableReply text={a.result} />
                              </div>
                            )}
                          </article>
                        ))}
                      </details>
                    ) : null}
                    <div className="thread-tools">
                      <button
                        onClick={async () => {
                          await update({
                            ...active,
                            archived: !active.archived,
                          });
                          setSelected(undefined);
                          setView("library");
                        }}
                      >
                        <Archive size={14} />
                        {active.archived ? "Restore Pact" : "Archive Pact"}
                      </button>
                      <span>
                        Saved on your device <Check size={13} />
                      </span>
                    </div>
                  </section>
                )}
                <div ref={end} />
              </div>
            </div>
            <footer className="composer-region">
              {error && (
                <div className="error-banner" role="alert">
                  <span>{error}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss message"
                    onClick={() => setError("")}
                  >
                    <X size={17} />
                  </button>
                  {active && !busy && (
                    <button className="text-button" onClick={retryAI}>
                      <RotateCcw size={14} /> Retry reply
                    </button>
                  )}
                </div>
              )}
              {!settings.onboarded && (
                <div className="onboarding-note">
                  <span>
                    <strong>Let Pact take the next step.</strong>
                    <small>Connect Fo whenever you’re ready.</small>
                  </span>
                  <button onClick={connectFo} disabled={connecting}>
                    Connect Fo <ArrowUpRight size={14} />
                  </button>
                  <button
                    aria-label="I'll connect Fo later"
                    className="icon-button"
                    onClick={onboard}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {capturing && captureMode === "pick" && (
                <p className="capture-instruction" role="status">
                  Choose an item on the page. Press Esc there to cancel.
                </p>
              )}
              <div className="page-controls" aria-label="Page context controls">
                <button
                  className="text-button"
                  onClick={() => void capture("page")}
                  disabled={capturing}
                >
                  <RotateCcw size={14} />
                  {capturing ? "Reading…" : "Read current page"}
                </button>
                <button
                  className="text-button"
                  onClick={() => void capture("pick")}
                  disabled={capturing}
                >
                  <MousePointer2 size={14} />
                  Select item
                </button>
              </div>
              {currentSource && (
                <div className={`attached-source ${pageStale ? "stale" : ""}`}>
                  <button onClick={() => setSourceOpen(true)}>
                    <Link2 size={14} />
                    <span>
                      {currentSource.title}
                      <small>
                        {currentSource.selection ? "Selected item · " : ""}
                        {captureLabel}
                      </small>
                    </span>
                    {currentSource.videoTime !== undefined && (
                      <small>{timestamp(currentSource.videoTime)}</small>
                    )}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Remove page context"
                    onClick={async () => {
                      if (active)
                        await update({
                          ...supersedeProposal(active),
                          source: undefined,
                        });
                      else setSource(undefined);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className={`composer ${listening ? "listening" : ""}`}>
                <textarea
                  ref={composer}
                  aria-label="Message Pact"
                  placeholder={
                    listening
                      ? "Listening…"
                      : active?.action?.status === "needs_answer"
                        ? "Reply to Fo…"
                        : "What do you want to get done?"
                  }
                  value={draft}
                  maxLength={8000}
                  rows={1}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="composer-actions">
                  <button
                    className="icon-button"
                    title="Add current page"
                    aria-label="Add current page"
                    onClick={() => void capture("page")}
                    disabled={capturing}
                  >
                    {capturing ? (
                      <Loader2 size={19} className="spin" />
                    ) : (
                      <Paperclip size={19} />
                    )}
                  </button>
                  <span>
                    {currentSource ? "Page attached" : "Attach current page"}
                  </span>
                  <button
                    className={`icon-button mic-button ${listening ? "active" : ""}`}
                    title={listening ? "Stop dictation" : "Dictate a message"}
                    aria-label={
                      listening ? "Stop dictation" : "Dictate a message"
                    }
                    aria-pressed={listening}
                    onClick={dictate}
                  >
                    {listening ? <AudioLines size={20} /> : <Mic size={19} />}
                  </button>
                  <button
                    className="send-button"
                    disabled={!draft.trim() || busy || capturing}
                    onClick={send}
                    aria-label="Send message"
                  >
                    {busy ? (
                      <Loader2 size={18} className="spin" />
                    ) : (
                      <ArrowUp size={20} />
                    )}
                  </button>
                </div>
              </div>
              <p className="composer-note">
                You choose what’s shared. You approve every action.
              </p>
            </footer>
          </>
        )}
      </main>
      {(settingsOpen || sourceOpen || reviewOpen || editorOpen) && (
        <div className="modal-backdrop" onClick={closeDialog}>
          <section
            ref={dialog}
            className="dialog"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const items = Array.from(
                dialog.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),a[href],input,summary,input[type=color]",
                ) ?? [],
              );
              const first = items[0],
                last = items.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2 id="dialog-title">
                {editorOpen
                  ? "Companion"
                  : settingsOpen
                    ? "Settings"
                    : sourceOpen
                      ? "Page context"
                      : "Review action"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={closeDialog}
                autoFocus={!editorOpen}
              >
                <X size={20} />
              </button>
            </header>
            {editorOpen ? (
              <>
                <div className="companion-stage" aria-hidden="true">
                  <Companion
                    appearance={draftCompanion}
                    dark={darkScheme}
                    size="hero"
                  />
                </div>
                <div className="editor-group">
                  <h3>Shape</h3>
                  <div className="shape-row" role="listbox" aria-label="Shape">
                    {SHAPE_OPTIONS.map((option) => (
                      <button
                        key={option.shape}
                        type="button"
                        role="option"
                        aria-selected={draftCompanion.shape === option.shape}
                        aria-label={option.name}
                        title={option.name}
                        className={`shape-tile${draftCompanion.shape === option.shape ? " selected" : ""}`}
                        onClick={() =>
                          setDraftCompanion((current) => ({
                            ...current,
                            shape: option.shape,
                          }))
                        }
                      >
                        <svg viewBox="0 0 72 72" fill="none" aria-hidden="true">
                          <path
                            d={SHAPES[option.shape]}
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="editor-group">
                  <h3>Color</h3>
                  <div className="swatch-row" role="listbox" aria-label="Color">
                    {COLOR_SWATCHES.map((swatch) => {
                      const value = companionColorForScheme(
                        swatch.color,
                        darkScheme,
                      );
                      const selected =
                        draftCompanion.color === swatch.color ||
                        draftCompanion.color === swatch.dark;
                      return (
                        <button
                          key={swatch.name}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-label={swatch.name}
                          title={swatch.name}
                          className={`color-swatch${selected ? " selected" : ""}`}
                          style={{ background: value }}
                          onClick={() =>
                            setDraftCompanion((current) => ({
                              ...current,
                              color: swatch.color,
                            }))
                          }
                        />
                      );
                    })}
                    <label
                      className={`color-swatch custom${
                        !COLOR_SWATCHES.some(
                          (swatch) =>
                            swatch.color === draftCompanion.color ||
                            swatch.dark === draftCompanion.color,
                        )
                          ? " selected"
                          : ""
                      }`}
                      title="Custom"
                    >
                      <span />
                      <input
                        type="color"
                        aria-label="Custom color"
                        value={
                          /^#[0-9A-Fa-f]{6}$/.test(draftCompanion.color)
                            ? draftCompanion.color
                            : "#8E8E93"
                        }
                        onChange={(e) =>
                          setDraftCompanion((current) => ({
                            ...current,
                            color: e.target.value.toUpperCase(),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <p className="swatch-name">
                    {companionSwatchName(draftCompanion.color)}
                  </p>
                </div>
                <div className="editor-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setDraftCompanion(companion);
                      setEditorOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="primary" onClick={() => void saveCompanion()}>
                    Done
                  </button>
                </div>
              </>
            ) : settingsOpen ? (
              <>
                <div className="settings-section">
                  <h3>Companion</h3>
                  <div className="connection-row">
                    <Companion
                      appearance={companion}
                      dark={darkScheme}
                      size="small"
                    />
                    <span>
                      <strong>{companionSwatchName(companion.color)}</strong>
                      <small>
                        {
                          SHAPE_OPTIONS.find(
                            (option) => option.shape === companion.shape,
                          )?.name
                        }{" "}
                        · accent for links
                      </small>
                    </span>
                  </div>
                  <button
                    className="secondary full"
                    onClick={openCompanionEditor}
                  >
                    Customize companion
                  </button>
                </div>
                <div className="settings-section">
                  <h3>Connections</h3>
                  <div className="connection-row">
                    <span className="service-mark">
                      fo<span>↗</span>
                    </span>
                    <span>
                      <strong>Fo by Wajo</strong>
                      <small>
                        {health.fo
                          ? "Connected to your Wajo account"
                          : "Real-world actions through your account"}
                      </small>
                    </span>
                    <span
                      className={`status-light ${health.fo ? "" : "offline"}`}
                    />
                  </div>
                  <p className="setting-description">
                    Fo can carry out supported tasks through your connected
                    services. You’ll review each proposed action first.
                  </p>
                  {authUrl && !health.fo && (
                    <a
                      className="primary full"
                      href={authUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Continue to Wajo
                      <ArrowUpRight size={18} />
                    </a>
                  )}
                  {health.fo ? (
                    <button
                      className="secondary full"
                      onClick={async () => {
                        try {
                          await api("/fo/disconnect", {});
                          await refreshHealth();
                        } catch (e) {
                          setError(errorText(e));
                        }
                      }}
                    >
                      Disconnect Fo
                    </button>
                  ) : (
                    <button
                      className="primary full"
                      disabled={connecting}
                      onClick={connectFo}
                    >
                      {connecting ? (
                        <Loader2 className="spin" size={17} />
                      ) : null}
                      Connect Fo
                      <ArrowUpRight size={18} />
                    </button>
                  )}
                  {!settings.onboarded && (
                    <button
                      className="text-button later"
                      onClick={() => {
                        void onboard();
                        closeDialog();
                      }}
                    >
                      I’ll do this later
                    </button>
                  )}
                </div>
                <div className="settings-section">
                  <div className="setting-line">
                    <h3>Intelligence</h3>
                    <span
                      className={`state-tag ${health.ai ? "connected" : ""}`}
                    >
                      {health.aiStatus?.budget.exhausted
                        ? "Paused · local limit"
                        : health.ai
                          ? "Available"
                          : "Not connected"}
                    </span>
                  </div>
                  <p className="setting-description">
                    {health.ai
                      ? "Claude helps make sense of your intention and the context you choose to share."
                      : "Connect Claude through the local companion. You can create and save Pacts while AI is offline."}
                  </p>
                  {health.aiStatus?.model && (
                    <div className="setting-line">
                      <span>Model</span>
                      <span>
                        {health.aiStatus.model === "claude-code-default"
                          ? "Claude account default"
                          : health.aiStatus.model}
                      </span>
                    </div>
                  )}
                  {health.aiStatus && health.aiStatus.provider !== "none" && (
                    <>
                      <div className="setting-line">
                        <span>Connection</span>
                        <span>
                          {health.aiStatus.provider === "claude-code"
                            ? "Claude Code"
                            : "Anthropic API"}
                        </span>
                      </div>
                      <div className="setting-line">
                        <span>Local AI allowance</span>
                        <span>
                          ${health.aiStatus.budget.remainingUsd.toFixed(2)} / $
                          {health.aiStatus.budget.capUsd.toFixed(2)} left
                        </span>
                      </div>
                      <p className="setting-description">
                        ${health.aiStatus.budget.spentUsd.toFixed(2)} reserved ·
                        up to ${health.aiStatus.budget.perRequestUsd.toFixed(2)}{" "}
                        per reply. This local limit is separate from your Claude
                        account balance.
                      </p>
                    </>
                  )}
                  <div className="setting-line">
                    <span>Local companion</span>
                    <span>{companionOnline ? "Running" : "Offline"}</span>
                  </div>
                </div>
                <div className="privacy-footnote">
                  <ShieldCheck size={18} />
                  <p>
                    Your Pacts stay in this browser. Page context is read when
                    you ask, and shared with Claude when you send a message. Fo
                    receives only the action you approve.
                  </p>
                </div>
              </>
            ) : sourceOpen && currentSource ? (
              <>
                <div className="source-detail">
                  <Globe size={26} />
                  <h3>{currentSource.title}</h3>
                  <p>
                    {captureLabel} ·{" "}
                    {new Date(currentSource.capturedAt).toLocaleTimeString(
                      undefined,
                      { hour: "numeric", minute: "2-digit" },
                    )}
                  </p>
                  <p>
                    Only this snapshot is shared. Read current page again after
                    scrolling, changing tabs, or moving through a video.
                  </p>
                  <a
                    href={sourceLink(currentSource, currentSource.videoTime)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {host(currentSource)}
                    <ExternalLink size={15} />
                  </a>
                  {currentSource.videoTime !== undefined && (
                    <p>Captured at {timestamp(currentSource.videoTime)}</p>
                  )}
                </div>
                {currentSource.selection && (
                  <blockquote>{currentSource.selection}</blockquote>
                )}
                <p className="source-description">
                  {currentSource.description ||
                    "No page description is available."}
                </p>
                {currentSource.transcriptStatus !== "not-video" && (
                  <div className="transcript">
                    <h3>
                      {currentSource.transcriptStatus === "available"
                        ? "In the video"
                        : "Transcript unavailable"}
                    </h3>
                    {currentSource.transcriptPartial && (
                      <p>
                        Showing selected passages around this moment and across
                        the video.
                      </p>
                    )}
                    {currentSource.transcriptStatus === "unavailable" ? (
                      <p>
                        Pact can see the page information, but hasn’t read the
                        video’s speech. Open YouTube’s transcript, then capture
                        the page again—or tell Pact what caught your eye.
                      </p>
                    ) : (
                      currentSource.transcript
                        .filter(
                          (x) =>
                            Math.abs(x.start - (currentSource.videoTime ?? 0)) <
                            75,
                        )
                        .slice(0, 16)
                        .map((line, i) => (
                          <a
                            key={i}
                            href={sourceLink(currentSource, line.start)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <time>{timestamp(line.start)}</time>
                            <span>{line.text}</span>
                          </a>
                        ))
                    )}
                  </div>
                )}
                {currentSource.viewportText && (
                  <details>
                    <summary>Visible when captured</summary>
                    <p className="captured-text">
                      {currentSource.viewportText}
                    </p>
                  </details>
                )}
                {currentSource.pageTextPartial && (
                  <p className="setting-description">
                    Page text was shortened. Select the specific item for more
                    focused context.
                  </p>
                )}
                <details>
                  <summary>Captured page text</summary>
                  <p className="captured-text">
                    {currentSource.text || "No article text was available."}
                  </p>
                </details>
                <button
                  className="secondary full"
                  onClick={() => void capture("page")}
                >
                  Refresh from current page
                </button>
              </>
            ) : reviewOpen && active?.action ? (
              <>
                <div className="review-symbol">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="review-title">{active.action.title}</h3>
                <p className="review-instruction">
                  {active.action.instruction}
                </p>
                <details className="tool-details">
                  <summary>Exact request to Fo</summary>
                  <p>{active.action.toolName}</p>
                  <pre>{JSON.stringify(active.action.arguments, null, 2)}</pre>
                </details>
                <p className="setting-description">
                  Approving sends this exact request to Fo through your Wajo
                  account. Fo may use your connected services. Review the
                  recipient and details carefully.
                </p>
                <button
                  className="primary full"
                  disabled={busy}
                  onClick={execute}
                >
                  Approve &amp; send to Fo
                  <ArrowUpRight size={18} />
                </button>
                <button
                  className="secondary full"
                  onClick={() => setReviewOpen(false)}
                >
                  Not yet
                </button>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
