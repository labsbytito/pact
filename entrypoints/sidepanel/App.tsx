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
  ChevronLeft,
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
  Compass,
  BookOpen,
  MapPin,
  MoreHorizontal,
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
import { read, write } from "../../lib/storage";
import { capturePage } from "../../lib/capture";
import { api, interpret, ApiError, type Health } from "../../lib/api";
function Companion({
  size = "normal",
  thinking = false,
}: {
  size?: "tiny" | "small" | "normal" | "hero";
  thinking?: boolean;
}) {
  return (
    <span
      className={`companion ${size} ${thinking ? "thinking" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 72 72" fill="none" focusable="false">
        <path
          className="mascot-fold"
          d="M24 11C25 5 32 3 37 7L61 26C68 32 65 40 57 42L43 46L24 11Z"
        />
        <path
          className="mascot-face"
          d="M13 26C14 18 19 12 27 13L50 17C57 18 61 23 59 31L53 53C51 61 45 65 37 62L17 55C10 53 8 47 10 40L13 26Z"
        />
        <path className="mascot-seam" d="M48 17L58 28L53 46" />
        <rect
          className="mascot-eye"
          x="25"
          y="29"
          width="4.6"
          height="11"
          rx="2.3"
          transform="rotate(9 25 29)"
        />
        <rect
          className="mascot-eye"
          x="38"
          y="31"
          width="4.6"
          height="11"
          rx="2.3"
          transform="rotate(9 38 31)"
        />
      </svg>
    </span>
  );
}
// Render links as React nodes: captured/returned text never becomes HTML.
function LinkedText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let previous = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"`]+/g)) {
    const start = match.index!;
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
const statusText = (a?: Action) =>
  !a
    ? "Conversation"
    : {
        proposed: "Ready for your review",
        approved: "Approved",
        running: "Fo is working",
        returned: "Fo replied",
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
    [reviewOpen, setReviewOpen] = useState(false);
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
    [authUrl, setAuthUrl] = useState<string>();
  const dialog = useRef<HTMLElement>(null);
  const initialCaptureAllowed = useRef(true);
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
    let cancelled = false;
    Promise.all([
      read<Pact[]>("pacts", []),
      read<Settings>("settings", { onboarded: false }),
    ])
      .then(([p, s]) => {
        if (cancelled) return;
        setPacts(p);
        pactsRef.current = p;
        setSettings(s);
        setLoaded(true);
        // Only the initial toolbar invocation, in the actual extension, reads a tab.
        if (
          typeof chrome !== "undefined" &&
          chrome.runtime?.id &&
          initialCaptureAllowed.current
        ) {
          setCapturing(true);
          void capturePage()
            .then((page) => {
              if (!cancelled && initialCaptureAllowed.current) setSource(page);
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
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    const invoked = (event: {type?:string}) => {
      if (event.type !== 'pact-invocation' || selected) return;
      setCapturing(true);
      void capturePage().then(setSource).catch(() => {}).finally(() => setCapturing(false));
    };
    chrome.runtime.onMessage.addListener(invoked);
    return () => chrome.runtime.onMessage.removeListener(invoked);
  }, [selected]);
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
    setSelected(undefined);
    setView("chat");
    setSource(undefined);
    setDraft("");
    setError("");
    composer.current?.focus();
  }
  function openPact(p: Pact) {
    initialCaptureAllowed.current = false;
    setSelected(p.id);
    setView("chat");
    setDraft("");
    setError("");
  }
  async function capture() {
    initialCaptureAllowed.current = false;
    setCapturing(true);
    setError("");
    try {
      const s = await capturePage();
      if (active) await update({ ...active, source: s });
      else setSource(s);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setCapturing(false);
    }
  }
  async function send() {
    if (!draft.trim() || busy) return;
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
        : makePact(text, source);
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
            status: "running" | "returned" | "failed" | "unknown";
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
          if (!cancelled) setError(errorText(e));
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
  };
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
        <Companion thinking />
        <p>Finding your Pacts…</p>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            newPact();
          }}
        >
          <Companion size="small" />
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
                  <Companion size="small" />
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
            <Companion size="tiny" />
            <span>pact.</span>
          </button>
          <div className="topbar-title">
            {active && view === "chat" ? (
              <>
                <span className="header-avatar">
                  <Companion size="small" />
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
                    <Companion size="normal" />
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
                <Companion size="normal" />
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
                      <Companion size="hero" />
                      <h1>Hi, I’m Pact.</h1>
                      <p>Bring me a page, or just a thought.</p>
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
                        {[
                          [
                            "Help me understand this page.",
                            "Understand this page",
                            BookOpen,
                          ],
                          [
                            "Help me turn what caught my attention on this page into a practical next step.",
                            "Find a next step",
                            Compass,
                          ],
                        ].map(([prompt, label, Icon]) => {
                          const ItemIcon = Icon as typeof BookOpen;
                          return (
                            <button
                              key={String(label)}
                              onClick={() => {
                                setDraft(String(prompt));
                                composer.current?.focus();
                              }}
                            >
                              <ItemIcon size={17} />
                              <span>{String(label)}</span>
                              <ArrowUpRight size={15} />
                            </button>
                          );
                        })}
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
                    {active.messages.map((m, i) => (
                      <div key={m.id} className={`message-row ${m.role}`}>
                        {m.role === "assistant" && <Companion size="tiny" />}
                        <div className="message">
                          <p>
                            {m.role === "assistant" ? (
                              <LinkedText text={m.text} />
                            ) : (
                              m.text
                            )}
                          </p>
                          <time>
                            {new Date(m.at).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                      </div>
                    ))}
                    {busy && (
                      <div className="message-row assistant">
                        <Companion size="tiny" thinking />
                        <div className="thinking-bubble" role="status">
                          <i />
                          <i />
                          <i />
                          <span className="sr-only">Pact is thinking</span>
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
                        <p>{active.action.instruction}</p>
                        {active.action.status === "proposed" && (
                          <>
                            <div className="action-assurance">
                              <ShieldCheck size={15} /> You review it. Fo takes
                              the next step.
                            </div>
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
                                : "Response from Fo"}
                            </strong>
                            <p>
                              <LinkedText text={active.action.result} />
                            </p>
                            {active.action.status === "returned" && (
                              <small>
                                A reply is not proof that every requested task
                                is complete. Check the outcome above.
                              </small>
                            )}
                          </div>
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
                            <p>{a.instruction}</p>
                            {a.result && (
                              <div className="result">
                                <p>
                                  <LinkedText text={a.result} />
                                </p>
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
              {currentSource && (
                <div className="attached-source">
                  <button onClick={() => setSourceOpen(true)}>
                    <Link2 size={14} />
                    <span>{currentSource.title}</span>
                    {currentSource.videoTime !== undefined && (
                      <small>{timestamp(currentSource.videoTime)}</small>
                    )}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Remove page context"
                    onClick={async () => {
                      if (active)
                        await update({ ...active, source: undefined });
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
                  placeholder={listening ? "Listening…" : "Message Pact…"}
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
                    onClick={capture}
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
                    disabled={!draft.trim() || busy}
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
      {(settingsOpen || sourceOpen || reviewOpen) && (
        <div className="modal-backdrop" onClick={closeDialog}>
          <section
            ref={dialog}
            className="dialog"
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const items = Array.from(
                dialog.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),a[href],input,summary",
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
                {settingsOpen
                  ? "Settings"
                  : sourceOpen
                    ? "Page context"
                    : "Review action"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={closeDialog}
                autoFocus
              >
                <X size={20} />
              </button>
            </header>
            {settingsOpen ? (
              <>
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
                      {health.ai ? "Available" : "Not connected"}
                    </span>
                  </div>
                  <p className="setting-description">
                    {health.ai
                      ? "Claude helps make sense of your intention and the context you choose to share."
                      : "Connect a permitted Claude API key through the local companion. You can create and save Pacts while it’s offline."}
                  </p>
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
                <details>
                  <summary>Captured page text</summary>
                  <p className="captured-text">
                    {currentSource.text || "No article text was available."}
                  </p>
                </details>
                <button className="secondary full" onClick={capture}>
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
