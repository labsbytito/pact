import { supersedeProposal, mergeReply, unresolved } from "../../lib/context";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
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
  FileText,
  Image as ImageIcon,
  User,
  SlidersHorizontal,
  Info,
  Unplug,
  Square,
  Copy,
  CheckCheck,
  RefreshCw,
  Pencil,
  Camera,
  MoreHorizontal,
  Pin,
  FolderInput,
  Trash2,
} from "lucide-react";
import type {
  Action,
  Pact,
  PactSection,
  Source,
  Settings,
  ThemePreference,
} from "../../lib/model";
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
import { groupLibraryPacts, normalizeSections } from "../../lib/library";
import PactMenu, { type PactMenuAction } from "./PactMenu";
import {
  capturePage,
  pendingSelection,
  type SelectionRequest,
} from "../../lib/capture";
import type { CaptureMode } from "../../lib/page-reader";
import {
  api,
  interpretLive,
  AbortInterpretError,
  ApiError,
  type Health,
} from "../../lib/api";
import {
  ATTACHMENT_LIMITS,
  prepareAttachment,
  prepareScreenshotAttachment,
  type Attachment,
} from "../../lib/attachments";
import { renderMarkdown } from "../../lib/markdown";
import { isImageMime } from "../../lib/images";
import Companion, { type PactBlobHandle, type BlobState } from "./Companion";
import { shouldGreet } from "./pactBlob";
import { SiteAccessSettings } from "./SiteAccess";
import {
  rememberInvocation,
  rememberObservedUrl,
  rememberedSitePattern,
  requestSiteRead,
  SITE_ACCESS_DENIED,
} from "../../lib/site-access";
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

type VoiceState = "idle" | "listening" | "transcribing" | "need-permission";
type SettingsSection =
  | "general"
  | "companion"
  | "fo"
  | "privacy"
  | "about";

const ICON = 1.5;
const APP_VERSION = "0.1.0";

function effectiveDark(
  theme: ThemePreference | undefined,
  systemDark: boolean,
) {
  if (theme === "light") return false;
  if (theme === "dark") return true;
  return systemDark;
}
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
function ReadableReply({
  text,
  streaming = false,
  stopped = false,
}: {
  text: string;
  streaming?: boolean;
  stopped?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const long = !streaming && text.length > 600;
  const boundary = text.lastIndexOf(" ", 420);
  let end = boundary > 240 ? boundary : 420;
  for (const token of text.matchAll(
    /\[[^\]\n]+\]\(https?:\/\/[^\s<>]+\)|https?:\/\/[^\s<>]+/g,
  ))
    if (token.index! < end && token.index! + token[0].length > end)
      end = token.index!;
  const excerpt = text.slice(0, end).trimEnd();
  const display = long && !expanded ? `${excerpt}…` : text;
  return (
    <div className={`reply-block${streaming ? " streaming" : ""}`}>
      {long && !expanded && (
        <small className="reply-excerpt-label">Opening excerpt</small>
      )}
      <div className="md-body">{renderMarkdown(display)}</div>
      {stopped && <small className="stopped-label">Stopped</small>}
      {long && (
        <button
          className="text-button reply-disclosure"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Read full reply"}
          <ChevronRight size={13} strokeWidth={ICON} />
        </button>
      )}
      {!streaming && text.trim() && (
        <div className="message-actions">
          <button
            type="button"
            className="icon-button"
            title={copied ? "Copied" : "Copy"}
            aria-label={copied ? "Copied" : "Copy reply"}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? (
              <CheckCheck size={14} strokeWidth={ICON} />
            ) : (
              <Copy size={14} strokeWidth={ICON} />
            )}
          </button>
        </div>
      )}
    </div>
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
    [voice, setVoice] = useState<VoiceState>("idle"),
    [attachments, setAttachments] = useState<Attachment[]>([]),
    [settingsSection, setSettingsSection] =
      useState<SettingsSection>("general"),
    [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]),
    [micGranted, setMicGranted] = useState(false),
    [streamText, setStreamText] = useState(""),
    [attachMenu, setAttachMenu] = useState(false),
    [editingMessageId, setEditingMessageId] = useState<string>(),
    [sections, setSections] = useState<PactSection[]>([]),
    [renamingId, setRenamingId] = useState<string>(),
    [renameDraft, setRenameDraft] = useState(""),
    [menu, setMenu] = useState<{
      pactId: string;
      x: number;
      y: number;
      origin: string;
    } | null>(null),
    [sectionMenu, setSectionMenu] = useState<{
      sectionId: string;
      x: number;
      y: number;
    } | null>(null),
    [toast, setToast] = useState<{
      id: number;
      message: string;
      undo: () => void;
    } | null>(null),
    [scrolledMain, setScrolledMain] = useState(false),
    [scrolledComposer, setScrolledComposer] = useState(false),
    [showSkeleton, setShowSkeleton] = useState(false),
    [uiReady, setUiReady] = useState(false),
    [menuExiting, setMenuExiting] = useState(false),
    [blobMood, setBlobMood] = useState<BlobState>("idle"),
    [composerFocused, setComposerFocused] = useState(false),
    [activityEpoch, setActivityEpoch] = useState(0),
    [health, setHealth] = useState<Health>({ ai: false, fo: false, tools: [] }),
    [companionOnline, setCompanionOnline] = useState(false),
    [healthChecked, setHealthChecked] = useState(false),
    [connecting, setConnecting] = useState(false),
    [authUrl, setAuthUrl] = useState<string>(),
    [companion, setCompanion] = useState<CompanionAppearance>(DEFAULT_COMPANION),
    [draftCompanion, setDraftCompanion] =
      useState<CompanionAppearance>(DEFAULT_COMPANION),
    [systemDark, setSystemDark] = useState(
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
    ),
    [callConfirmed, setCallConfirmed] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const interpretAbort = useRef<AbortController | null>(null);
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
    writeQueue = useRef(Promise.resolve()),
    heroBlob = useRef<PactBlobHandle>(null),
    moodTimer = useRef(0);
  const listening = voice === "listening" || voice === "transcribing";
  const darkScheme = effectiveDark(settings.theme, systemDark);
  const active = pacts.find((p) => p.id === selected);
  const currentSource = active ? active.source : source;
  const bumpActivity = () => setActivityEpoch((n) => n + 1);
  const blobLook = composerFocused ? { x: 0, y: 3 } : undefined;
  const blobCaption =
    capturing
      ? "Reading page…"
      : busy && !streamText
        ? "Thinking…"
        : busy && streamText
          ? "Writing…"
          : listening
            ? "Listening…"
            : "";
  const liveBlobState: BlobState =
    blobMood === "greeting" ||
    blobMood === "happy" ||
    blobMood === "error" ||
    blobMood === "sleepy" ||
    blobMood === "still"
      ? blobMood
      : listening
        ? "listening"
        : capturing || (busy && !streamText)
          ? "thinking"
          : busy && streamText
            ? "speaking"
            : "idle";
  function sectionTag(p: { sectionId?: string | null; pinned?: boolean }) {
    if (p.pinned) return "Pinned";
    const section = sections.find((s) => s.id === p.sectionId);
    return section?.name ?? "Pact";
  }
  function previewText(p: { messages: { text: string }[]; intention: string }) {
    const last = p.messages.at(-1)?.text ?? p.intention;
    return last.replace(/\s+/g, " ").trim();
  }
  function isUnread(p: { id: string; messages: { role: string }[] }) {
    if (selected === p.id && view === "chat") return false;
    const last = p.messages.at(-1);
    return last?.role === "assistant";
  }
  const libraryGroups = groupLibraryPacts(pacts, sections, {
    archived,
    query: search,
  });
  const sidebarGroups = groupLibraryPacts(pacts, sections, {
    archived: false,
    query: search,
  });
  const menuPact = menu
    ? pacts.find((p) => p.id === menu.pactId)
    : undefined;
  const healthPill = !healthChecked
    ? ""
    : !companionOnline
      ? "Companion offline"
      : !health.ai
        ? "AI offline"
        : "";
  const statusLabel = capturing
    ? "Reading page…"
    : busy && !streamText
      ? "Thinking…"
      : busy && streamText
        ? "Writing…"
        : active?.action?.status === "running" ||
            active?.action?.status === "approved"
          ? "Fo is working…"
          : "";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => setSystemDark(media.matches);
    media.addEventListener("change", onScheme);
    return () => media.removeEventListener("change", onScheme);
  }, []);
  useEffect(() => {
    const theme = settings.theme ?? "system";
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [settings.theme]);
  useEffect(() => {
    const accent = companionColorForScheme(companion.color, darkScheme);
    document.documentElement.style.setProperty("--companion", accent);
  }, [companion.color, darkScheme]);
  useEffect(() => {
    let cancelled = false;
    async function syncMic() {
      const {
        queryMicPermission,
        listMicrophones,
      } = await import("../../lib/mic");
      const state = await queryMicPermission();
      if (cancelled) return;
      setMicGranted(state === "granted");
      if (state === "granted") {
        const devices = await listMicrophones();
        if (!cancelled) setMicDevices(devices);
      }
    }
    void syncMic();
    const onMessage = (message: { type?: string }) => {
      if (message?.type === "pact-mic-granted") void syncMic();
    };
    if (typeof chrome !== "undefined" && chrome.runtime?.onMessage)
      chrome.runtime.onMessage.addListener(onMessage);
    const onFocus = () => void syncMic();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      if (typeof chrome !== "undefined" && chrome.runtime?.onMessage)
        chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      read<Pact[]>("pacts", []),
      read<Settings>("settings", { onboarded: false }),
      read<string | null>("activePact", null),
      readSync<unknown>("companion", DEFAULT_COMPANION),
      read<unknown>("sections", []),
    ])
      .then(([stored, s, last, savedCompanion, savedSections]) => {
        if (cancelled) return;
        const p = withCharacterSeeds(stored);
        setPacts(p);
        pactsRef.current = p;
        if (stored.some((item) => !item.characterSeed))
          void save(p).catch(() => {});
        setSettings(s);
        setSections(normalizeSections(savedSections));
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
            .catch((e) => {
              if (!cancelled) setError(errorText(e));
            })
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
      tabId?: number;
      origin?: string;
      selection?: SelectionRequest;
    }) => {
      if (event.type !== "pact-invocation" && event.type !== "pact-selection")
        return;
      if (event.selection)
        rememberInvocation({
          tabId: event.selection.tabId,
          url: event.selection.url,
        });
      else
        rememberInvocation({ tabId: event.tabId, origin: event.origin });
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
    void chrome.windows.getCurrent().then(async (window) => {
      const stored = await chrome.storage.session.get([
        `pactInvocation:${window.id}`,
        "pactInvocation",
      ]);
      const invocation = (stored[`pactInvocation:${window.id}`] ??
        stored.pactInvocation) as
        | { tabId?: number; origin?: string }
        | undefined;
      if (invocation)
        rememberInvocation({
          tabId: invocation.tabId,
          origin: invocation.origin,
        });
    });
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
      if (info.url) rememberObservedUrl(id, info.url);
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
    } finally {
      setHealthChecked(true);
    }
  }
  async function saveSections(next: PactSection[]) {
    setSections(next);
    await write("sections", next);
  }
  function showUndo(message: string, undo: () => void) {
    const id = Date.now();
    setToast({ id, message, undo });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 5000);
  }
  async function applyPactMenu(pact: Pact, action: PactMenuAction) {
    if (action.type === "pin") {
      await update({ ...pact, pinned: !pact.pinned });
      return;
    }
    if (action.type === "rename") {
      setRenamingId(pact.id);
      setRenameDraft(pact.title);
      return;
    }
    if (action.type === "archive") {
      const nextArchived = !pact.archived;
      const snapshot = { ...pact };
      await update({ ...pact, archived: nextArchived });
      if (selected === pact.id && nextArchived) {
        setSelected(undefined);
        setView("library");
      }
      showUndo(
        nextArchived ? "Pact archived · Undo" : "Pact restored · Undo",
        () => {
          void update(snapshot);
        },
      );
      return;
    }
    if (action.type === "delete") {
      const snapshot = pactsRef.current.slice();
      const next = snapshot.filter((p) => p.id !== pact.id);
      await save(next);
      if (selected === pact.id) {
        setSelected(undefined);
        setView("library");
      }
      showUndo("Pact deleted · Undo", () => {
        void save(snapshot);
      });
      return;
    }
    if (action.type === "move") {
      await update({ ...pact, sectionId: action.sectionId });
      return;
    }
    if (action.type === "new-section") {
      const name = window.prompt("Section name");
      if (!name?.trim()) return;
      const section: PactSection = {
        id: uid(),
        name: name.trim().slice(0, 60),
        createdAt: now(),
      };
      await saveSections([...sections, section]);
      await update({ ...pact, sectionId: section.id });
    }
  }
  async function commitRename(pactId: string) {
    const pact = pactsRef.current.find((p) => p.id === pactId);
    const title = renameDraft.trim().slice(0, 72);
    setRenamingId(undefined);
    if (!pact || !title || title === pact.title) return;
    await update({ ...pact, title });
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
    const timer = window.setTimeout(() => setShowSkeleton(true), 200);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!loaded || uiReady) return;
    if (!showSkeleton) {
      setUiReady(true);
      return;
    }
    const timer = window.setTimeout(() => setUiReady(true), 400);
    return () => window.clearTimeout(timer);
  }, [loaded, showSkeleton, uiReady]);
  useEffect(() => {
    if (!uiReady) return;
    let cancelled = false;
    void shouldGreet().then((greet) => {
      if (cancelled || !greet) return;
      setBlobMood("greeting");
      window.clearTimeout(moodTimer.current);
      moodTimer.current = window.setTimeout(() => setBlobMood("idle"), 900);
    });
    return () => {
      cancelled = true;
    };
  }, [uiReady]);
  useEffect(() => {
    const onActivity = () => {
      bumpActivity();
      setBlobMood((m) => (m === "sleepy" || m === "still" ? "idle" : m));
    };
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, []);
  useEffect(() => {
    if (busy || listening || capturing) return;
    const stillT = window.setTimeout(() => {
      setBlobMood((m) =>
        m === "greeting" || m === "happy" || m === "error" ? m : "still",
      );
    }, 60_000);
    const sleepT = window.setTimeout(() => setBlobMood("sleepy"), 300_000);
    return () => {
      window.clearTimeout(stillT);
      window.clearTimeout(sleepT);
    };
  }, [activityEpoch, busy, listening, capturing]);
  useEffect(() => {
    if (error) {
      setBlobMood("error");
      window.clearTimeout(moodTimer.current);
      moodTimer.current = window.setTimeout(() => setBlobMood("idle"), 1900);
    }
  }, [error]);
  function closeMenu() {
    if (!menu || menuExiting) return;
    setMenuExiting(true);
    window.setTimeout(() => {
      setMenu(null);
      setMenuExiting(false);
    }, 100);
  }
  function openPactMenuAt(
    event: MouseEvent,
    pactId: string,
    mode: "dots" | "context",
  ) {
    event.preventDefault();
    event.stopPropagation();
    const rect =
      mode === "dots"
        ? (event.currentTarget as HTMLElement).getBoundingClientRect()
        : null;
    const x = rect ? Math.min(rect.left, window.innerWidth - 220) : event.clientX;
    const y = rect ? rect.bottom + 4 : event.clientY;
    const originX = x + 110 > window.innerWidth / 2 ? "right" : "left";
    const originY = y > window.innerHeight / 2 ? "bottom" : "top";
    setMenuExiting(false);
    setMenu({
      pactId,
      x,
      y,
      origin: `${originY} ${originX}`,
    });
  }
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
  async function persistSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await write("settings", next);
  }
  async function onboard() {
    await persistSettings({ onboarded: true });
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
    setAttachments([]);
    setError("");
    setVoice("idle");
    speech.current?.abort?.();
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
  function readFromPanel(mode: CaptureMode = "page") {
    // requestSiteRead runs before capture's awaits so this click stays the gesture.
    void requestSiteRead(rememberedSitePattern()).then(
      (granted) => {
        if (!granted) {
          setError(SITE_ACCESS_DENIED);
          return;
        }
        void capture(mode);
      },
      (error) => setError(errorText(error)),
    );
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
      const thin =
        `${page.text || ""}${page.selection || ""}`.trim().length < 80 &&
        !(page.transcript?.length);
      if (thin)
        setError(
          "Pact found almost no readable text. Use Allow this site if this page is not allowed yet, or scroll to the article and read again.",
        );
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
  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    setError("");
    const room = ATTACHMENT_LIMITS.maxFiles - attachments.length;
    if (room <= 0) {
      setError(`You can attach up to ${ATTACHMENT_LIMITS.maxFiles} files.`);
      return;
    }
    const next: Attachment[] = [...attachments];
    for (const file of incoming.slice(0, room)) {
      try {
        next.push(await prepareAttachment(file));
      } catch (e) {
        setError(errorText(e));
      }
    }
    setAttachments(next);
  }
  function removeAttachment(id: string) {
    setAttachments((list) => list.filter((item) => item.id !== id));
  }
  function stopInterpret() {
    interpretAbort.current?.abort();
  }
  async function runInterpret(p: Pact, pending: Attachment[] = []) {
    setBusy(true);
    setStreamText("");
    setError("");
    const controller = new AbortController();
    interpretAbort.current = controller;
    let live = "";
    const preferStream = health.aiStatus?.provider === "anthropic-api";
    try {
      const result = await interpretLive(p, pending, {
        signal: controller.signal,
        preferStream,
        onDelta: (chunk) => {
          live += chunk;
          setStreamText(live);
          heroBlob.current?.pulse();
          bumpActivity();
        },
      });
      const latest = pactsRef.current.find((x) => x.id === p.id) ?? p;
      await update(mergeReply(latest, result, uid(), now()));
      await refreshHealth();
      setBlobMood("happy");
      window.clearTimeout(moodTimer.current);
      moodTimer.current = window.setTimeout(() => setBlobMood("idle"), 700);
    } catch (e) {
      const partial =
        e instanceof AbortInterpretError ? e.partial.trim() : live.trim();
      const userStopped =
        e instanceof AbortInterpretError
          ? e.userInitiated || controller.signal.aborted
          : controller.signal.aborted;
      if (partial) {
        const latest = pactsRef.current.find((x) => x.id === p.id) ?? p;
        await update(
          mergeReply(
            latest,
            { reply: partial, stopped: true },
            uid(),
            now(),
          ),
        );
      }
      if (userStopped && e instanceof AbortInterpretError) {
        if (!partial)
          setError("Stopped before a reply started.");
      } else {
        setError(errorText(e));
        setBlobMood("error");
        window.clearTimeout(moodTimer.current);
        moodTimer.current = window.setTimeout(() => setBlobMood("idle"), 1900);
      }
    } finally {
      interpretAbort.current = null;
      setStreamText("");
      setBusy(false);
    }
  }
  async function send(overrideText?: string) {
    const text =
      (overrideText ?? draft).trim() ||
      (attachments.length
        ? `Look at the attached file${attachments.length > 1 ? "s" : ""}.`
        : "");
    if ((!text && !attachments.length) || busy || capturing) return;
    initialCaptureAllowed.current = false;
    const pending = attachments;
    if (!overrideText) {
      setDraft("");
      setAttachments([]);
      setEditingMessageId(undefined);
    }
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
      await runInterpret(p, pending);
    } catch (e) {
      setDraft(text);
      setAttachments(pending);
      setError(errorText(e));
      setBusy(false);
    }
  }
  async function retryAI() {
    if (!active || busy) return;
    const withoutLastAssistant = {
      ...active,
      messages: (() => {
        const msgs = [...active.messages];
        if (msgs.at(-1)?.role === "assistant") msgs.pop();
        return msgs;
      })(),
    };
    if (withoutLastAssistant.action?.status === "proposed") {
      const cleared = supersedeProposal(withoutLastAssistant);
      await update(cleared);
      await runInterpret(cleared);
      return;
    }
    await update(withoutLastAssistant);
    await runInterpret(withoutLastAssistant);
  }
  async function regenerate() {
    if (!active || busy) return;
    await retryAI();
  }
  async function editAndResend(messageId: string) {
    if (!active || busy) return;
    const index = active.messages.findIndex((m) => m.id === messageId);
    if (index < 0 || active.messages[index]?.role !== "user") return;
    const target = active.messages[index]!;
    setDraft(target.text);
    setEditingMessageId(messageId);
    setAttachments([]);
    composer.current?.focus();
  }
  async function confirmEditResend() {
    if (!active || !editingMessageId || busy) return;
    const index = active.messages.findIndex((m) => m.id === editingMessageId);
    if (index < 0) return;
    const text = draft.trim();
    if (!text) return;
    if (active.action?.status === "proposed" && active.action.planId) {
      await api("/actions/cancel", { planId: active.action.planId }).catch(
        () => {},
      );
    }
    const cut = supersedeProposal({
      ...active,
      messages: [
        ...active.messages.slice(0, index),
        message("user", text),
      ],
      intention: index === 0 ? text : active.intention,
      title: index === 0 ? text.slice(0, 72) : active.title,
    });
    setDraft("");
    setEditingMessageId(undefined);
    setAttachments([]);
    await update(cut);
    await runInterpret(cut, []);
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
        ...(action.consequential ? { confirmConsequential: true } : {}),
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
  async function startRecognition() {
    const Speech =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setVoice("idle");
      setError(
        "Dictation isn’t available in this browser. You can always type your message.",
      );
      return;
    }
    try {
      const { probeMicrophone } = await import("../../lib/mic");
      await probeMicrophone(settings.micDeviceId);
    } catch {
      setVoice("need-permission");
      setError(
        "Microphone isn’t available yet. Allow it once, then try dictation again.",
      );
      return;
    }
    const recognition = new Speech();
    recognition.lang = navigator.language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setVoice("listening");
    recognition.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0]?.transcript ?? "";
        if (e.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      if (finalText) {
        setVoice("transcribing");
        setDraft((d) => `${d}${d ? " " : ""}${finalText.trim()}`);
      } else if (interim) setVoice("listening");
    };
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setVoice("need-permission");
        setError(
          "Microphone is blocked for Pact. Open mic settings to allow it.",
        );
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        setError("Dictation couldn’t finish. Try again, or type your message.");
        setVoice("idle");
      } else setVoice("idle");
    };
    recognition.onend = () => setVoice((v) => (v === "need-permission" ? v : "idle"));
    speech.current = recognition;
    try {
      recognition.start();
      setVoice("listening");
    } catch {
      setVoice("idle");
      setError("Dictation couldn’t start. Try again in a moment.");
    }
  }
  async function dictate() {
    if (listening) {
      speech.current?.stop?.();
      setVoice("idle");
      return;
    }
    setError("");
    const { queryMicPermission, openMicPermissionPage } = await import(
      "../../lib/mic"
    );
    const permission = await queryMicPermission();
    if (permission === "denied") {
      setVoice("need-permission");
      setError(
        "Microphone is blocked. Open mic settings, allow Pact, then try again.",
      );
      return;
    }
    if (permission !== "granted") {
      setVoice("need-permission");
      try {
        await openMicPermissionPage();
      } catch (e) {
        setError(errorText(e));
      }
      return;
    }
    setMicGranted(true);
    await startRecognition();
  }
  async function openMicHelp() {
    const { queryMicPermission, openMicPermissionPage, openMicSiteSettings } =
      await import("../../lib/mic");
    const permission = await queryMicPermission();
    try {
      if (permission === "denied") await openMicSiteSettings();
      else await openMicPermissionPage();
    } catch (e) {
      setError(errorText(e));
    }
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
    setCallConfirmed(false);
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
      if (e.key === "F2" && selected && !renamingId && !busy) {
        const pact = pactsRef.current.find((p) => p.id === selected);
        if (!pact) return;
        e.preventDefault();
        setRenamingId(pact.id);
        setRenameDraft(pact.title);
        return;
      }
      if (e.key === "Escape") {
        if (busy) {
          e.preventDefault();
          stopInterpret();
          return;
        }
        if (renamingId) {
          setRenamingId(undefined);
          return;
        }
        if (menu) {
          closeMenu();
          return;
        }
        if (sectionMenu) {
          setSectionMenu(null);
          return;
        }
        if (attachMenu) {
          setAttachMenu(false);
          return;
        }
        closeDialog();
      }
    }
    function dismissMenu() {
      closeMenu();
      setSectionMenu(null);
    }
    window.addEventListener("keydown", key);
    window.addEventListener("click", dismissMenu);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("click", dismissMenu);
    };
  }, [busy, attachMenu, menu, menuExiting, renamingId, selected, sectionMenu]);
  if (!uiReady)
    return (
      <div className={`boot${showSkeleton ? "" : " boot-quiet"}`} aria-busy="true">
        <div className="skeleton-row short" />
        <div className="skeleton-row mid" />
        <div className="skeleton-row wide" />
        <div className="skeleton-row mid" />
        <div className="skeleton-row wide" />
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
        <div className="recent-list">
          {sidebarGroups.map((group) =>
            !group.pacts.length ? null : (
              <div key={group.id ?? "root"} className="library-group">
                <p className="recent-label">
                  {group.id === "__pinned__" ? "Pinned" : group.name}
                </p>
                {group.pacts.slice(0, 30).map((p) => (
                  <div
                    key={p.id}
                    className={`recent-row ${selected === p.id && view === "chat" ? "selected" : ""}`}
                    onContextMenu={(e) => openPactMenuAt(e, p.id, "context")}
                  >
                    {renamingId === p.id ? (
                      <input
                        className="rename-input"
                        value={renameDraft}
                        aria-label="Rename Pact"
                        autoFocus
                        ref={(node) => node?.select()}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => void commitRename(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitRename(p.id);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setRenamingId(undefined);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="recent"
                        onClick={() => openPact(p)}
                      >
                        <span className="recent-avatar">
                          <Companion
                            seed={p.characterSeed ?? p.id}
                            size={32}
                            lively={false}
                          />
                        </span>
                        <span className="recent-copy">
                          <span className="recent-line">
                            <strong className="recent-title">{p.title}</strong>
                            <span className="recent-tag">{sectionTag(p)}</span>
                          </span>
                          <span className="recent-preview">{previewText(p)}</span>
                        </span>
                        {isUnread(p) ? (
                          <span className="unread-dot" aria-label="Unread" />
                        ) : (
                          <time className="recent-meta">
                            {new Date(p.updatedAt).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </time>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button pact-more"
                      data-open={menu?.pactId === p.id ? "true" : undefined}
                      aria-label={`Actions for ${p.title}`}
                      onClick={(e) => openPactMenuAt(e, p.id, "dots")}
                    >
                      <MoreHorizontal size={16} strokeWidth={ICON} />
                    </button>
                  </div>
                ))}
              </div>
            ),
          )}
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
        <header className={`topbar${scrolledMain ? " glass scrolled" : ""}`}>
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
              lively={false}
            />
            <span>pact.</span>
          </button>
          <div className="topbar-title">
            {active && view === "chat" ? (
              <>
                <span className="header-avatar">
                  <Companion
                    seed={active.characterSeed ?? active.id}
                    size={24}
                    state={liveBlobState}
                    look={blobLook}
                    lively
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
        <p className="setting-description" role="status">
          {companionOnline
            ? `Claude key ${health.keyPresent ? "present" : "missing"}, model ${health.model ?? health.aiStatus?.model ?? "none"}, Fo ${health.fo ? "signed in" : health.needsReconnect ? "needs reconnect" : "signed out"}`
            : "Companion offline. Start it with pnpm run server."}
        </p>
        {view === "library" ? (
          <section className="library">
            <h1>My Pacts</h1>
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
              <button
                className="text-button"
                onClick={async () => {
                  const name = window.prompt("Section name");
                  if (!name?.trim()) return;
                  await saveSections([
                    ...sections,
                    {
                      id: uid(),
                      name: name.trim().slice(0, 60),
                      createdAt: now(),
                    },
                  ]);
                }}
              >
                <FolderInput size={17} strokeWidth={ICON} />
                Section
              </button>
            </div>
            {libraryGroups.map((group) =>
              !group.pacts.length && group.id === null ? null : (
                <div key={group.id ?? "root"} className="library-group">
                  <div className="library-group-head">
                    <h2>{group.name}</h2>
                    {group.id &&
                      group.id !== "__pinned__" &&
                      sections.some((s) => s.id === group.id) && (
                        <button
                          type="button"
                          className="icon-button section-more"
                          data-open={
                            sectionMenu?.sectionId === group.id
                              ? "true"
                              : undefined
                          }
                          aria-label={`Section actions for ${group.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (
                              e.currentTarget as HTMLElement
                            ).getBoundingClientRect();
                            setMenu(null);
                            setSectionMenu({
                              sectionId: group.id!,
                              x: Math.min(rect.left, window.innerWidth - 200),
                              y: rect.bottom + 4,
                            });
                          }}
                        >
                          <MoreHorizontal size={16} strokeWidth={ICON} />
                        </button>
                      )}
                  </div>
                  <div className="pact-grid">
                    {group.pacts.map((p) => (
                      <div
                        key={p.id}
                        className="pact-tile-wrap"
                        onContextMenu={(e) => openPactMenuAt(e, p.id, "context")}
                      >
                        {renamingId === p.id ? (
                          <input
                            className="rename-input"
                            value={renameDraft}
                            aria-label="Rename Pact"
                            autoFocus
                            ref={(node) => node?.select()}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => void commitRename(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void commitRename(p.id);
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setRenamingId(undefined);
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            className="pact-tile"
                            onClick={() => openPact(p)}
                          >
                            <span className="recent-avatar">
                              <Companion
                                seed={p.characterSeed ?? p.id}
                                size={32}
                                lively={false}
                              />
                            </span>
                            <span className="recent-copy">
                              <span className="recent-line">
                                <strong className="recent-title">
                                  {p.pinned ? (
                                    <>
                                      <Pin size={12} strokeWidth={ICON} />{" "}
                                    </>
                                  ) : null}
                                  {p.title}
                                </strong>
                                <span className="recent-tag">{sectionTag(p)}</span>
                              </span>
                              <span className="recent-preview">
                                {previewText(p)}
                              </span>
                            </span>
                            {isUnread(p) ? (
                              <span className="unread-dot" aria-label="Unread" />
                            ) : (
                              <time className="recent-meta">
                                {new Date(p.updatedAt).toLocaleTimeString(
                                  undefined,
                                  { hour: "numeric", minute: "2-digit" },
                                )}
                              </time>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-button pact-more"
                          data-open={menu?.pactId === p.id ? "true" : undefined}
                          aria-label={`Actions for ${p.title}`}
                          onClick={(e) => openPactMenuAt(e, p.id, "dots")}
                        >
                          <MoreHorizontal size={16} strokeWidth={ICON} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            )}
            {!libraryGroups.some((g) => g.pacts.length) && (
              <div className="library-empty">
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
                <div className="suggestions" aria-label="Suggestions">
                  {!archived && (
                    <button type="button" onClick={newPact}>
                      Make a Pact
                    </button>
                  )}
                  {search ? (
                    <button type="button" onClick={() => setSearch("")}>
                      Clear search
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setArchived(!archived)}
                    >
                      {archived ? "Show active" : "Show archive"}
                    </button>
                  )}
                  {!archived && !search && (
                    <button
                      type="button"
                      onClick={() => {
                        setView("chat");
                        setSelected(undefined);
                      }}
                    >
                      Ask about this page
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            <div
              className="conversation-scroll"
              onScroll={(e) => {
                const el = e.currentTarget;
                setScrolledMain(el.scrollTop > 4);
                setScrolledComposer(
                  el.scrollHeight - el.scrollTop - el.clientHeight > 8,
                );
              }}
            >
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
                        state={liveBlobState}
                        look={blobLook}
                        caption={blobCaption || undefined}
                        blobRef={heroBlob}
                        lively
                      />
                      <div className="hello-copy">
                        <h1>What should we get done on this page?</h1>
                        <p>Read the page, or just ask.</p>
                        <button
                          type="button"
                          className="hello-edit"
                          onClick={openCompanionEditor}
                        >
                          Customize companion
                        </button>
                      </div>
                    </div>
                    <button
                      className={`capture-card ${currentSource ? "captured" : ""}`}
                      onClick={() =>
                        currentSource ? setSourceOpen(true) : readFromPanel()
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
                    <div
                      className="suggestions"
                      aria-label="Ways to start"
                    >
                      {(
                        [
                          [
                            "Help me turn what caught my attention on this page into a practical next step.",
                            "Plan next step",
                          ],
                          [
                            "Draft a short note about what I’m looking at.",
                            "Draft a note",
                          ],
                        ] as const
                      ).map(([prompt, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setDraft(prompt);
                            composer.current?.focus();
                          }}
                        >
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
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
                    {active.messages.map((m, index) => {
                      const isLast = index === active.messages.length - 1;
                      const lastUser = [...active.messages]
                        .reverse()
                        .find((x) => x.role === "user");
                      return (
                        <div key={m.id} className={`message-row ${m.role}`}>
                          <div className="message">
                            {m.role === "assistant" ? (
                              <ReadableReply
                                text={m.text}
                                stopped={!!m.stopped}
                              />
                            ) : (
                              <p>{m.text}</p>
                            )}
                            {!busy && (
                              <div className="message-actions">
                                {m.role === "assistant" && isLast && (
                                  <button
                                    type="button"
                                    className="icon-button"
                                    title="Regenerate"
                                    aria-label="Regenerate reply"
                                    onClick={() => void regenerate()}
                                  >
                                    <RefreshCw size={14} strokeWidth={ICON} />
                                  </button>
                                )}
                                {m.role === "user" &&
                                  lastUser?.id === m.id && (
                                    <button
                                      type="button"
                                      className="icon-button"
                                      title="Edit & resend"
                                      aria-label="Edit and resend"
                                      onClick={() => void editAndResend(m.id)}
                                    >
                                      <Pencil size={14} strokeWidth={ICON} />
                                    </button>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {busy && (
                      <div className="message-row assistant">
                        {streamText ? (
                          <div className="message">
                            <ReadableReply text={streamText} streaming />
                          </div>
                        ) : (
                          <div className="thinking-bubble" role="status">
                            Thinking…
                          </div>
                        )}
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
                                    ? (setCallConfirmed(false),
                                      setReviewOpen(true))
                                    : setSettingsOpen(true)
                              }
                            >
                              {active.action.expiresAt &&
                              Date.parse(active.action.expiresAt) < Date.now()
                                ? "Refresh next step"
                                : health.fo
                                  ? "Review next step"
                                  : health.needsReconnect
                                    ? "Reconnect Fo to continue"
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
            <footer
              className="composer-region"
            >
              {toast && (
                <div className="undo-toast" role="status" aria-live="polite">
                  <span>{toast.message}</span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      toast.undo();
                      setToast(null);
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}
              {healthPill && !error && (
                <div className="health-banner" role="status">
                  <span className="status-dot" aria-hidden="true" />
                  <span>{healthPill}</span>
                  <button
                    className="text-button"
                    onClick={() => void refreshHealth()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  <span className="status-dot" aria-hidden="true" />
                  <span>{error}</span>
                  {/toolbar icon|Allow this site|permission to read this site|almost no readable text|PDF viewer/.test(
                    error,
                  ) && (
                    <button
                      className="text-button"
                      onClick={() => readFromPanel(captureMode)}
                    >
                      Allow this site
                    </button>
                  )}
                  {active && !busy && (
                    <button className="text-button" onClick={retryAI}>
                      Retry
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Dismiss message"
                    onClick={() => setError("")}
                  >
                    <X size={15} />
                  </button>
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
                  onClick={() => readFromPanel("page")}
                  disabled={capturing}
                >
                  <RotateCcw size={14} />
                  {capturing ? "Reading…" : "Read current page"}
                </button>
                <button
                  className="text-button"
                  onClick={() => readFromPanel("pick")}
                  disabled={capturing}
                >
                  <MousePointer2 size={14} />
                  Select item
                </button>
              </div>
              {currentSource && (
                <div className={`attached-source ${pageStale ? "stale" : ""}`}>
                  <button onClick={() => setSourceOpen(true)}>
                    <Link2 size={14} strokeWidth={ICON} />
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
                    <X size={14} strokeWidth={ICON} />
                  </button>
                </div>
              )}
              {(statusLabel ||
                attachments.length > 0 ||
                voice !== "idle" ||
                editingMessageId) && (
                <div className="composer-meta" aria-live="polite">
                  {statusLabel && (
                    <span className="voice-chip status">{statusLabel}</span>
                  )}
                  {editingMessageId && (
                    <span className="voice-chip action">
                      Editing message · Enter to resend
                    </span>
                  )}
                  {voice === "listening" && (
                    <span className="voice-chip listening">Listening…</span>
                  )}
                  {voice === "transcribing" && (
                    <span className="voice-chip">Transcribing…</span>
                  )}
                  {voice === "need-permission" && (
                    <button
                      type="button"
                      className="voice-chip action"
                      onClick={() => void openMicHelp()}
                    >
                      Open mic settings
                    </button>
                  )}
                  {attachments.map((item) => (
                    <span key={item.id} className="attach-chip">
                      {item.kind === "image" && item.previewUrl ? (
                        <img src={item.previewUrl} alt="" />
                      ) : item.kind === "image" ? (
                        <ImageIcon size={14} strokeWidth={ICON} />
                      ) : (
                        <FileText size={14} strokeWidth={ICON} />
                      )}
                      <span title={item.name}>{item.name}</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeAttachment(item.id)}
                      >
                        <X size={12} strokeWidth={ICON} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                accept={ATTACHMENT_LIMITS.accept}
                multiple
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {attachMenu && (
                <div className="attach-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAttachMenu(false);
                      fileInput.current?.click();
                    }}
                  >
                    <Paperclip size={15} strokeWidth={ICON} />
                    Attach file
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAttachMenu(false);
                      void (async () => {
                        try {
                          const shot = await prepareScreenshotAttachment();
                          setAttachments((list) => {
                            if (list.length >= ATTACHMENT_LIMITS.maxFiles) {
                              setError(
                                `You can attach up to ${ATTACHMENT_LIMITS.maxFiles} files.`,
                              );
                              return list;
                            }
                            return [...list, shot];
                          });
                        } catch (e) {
                          setError(errorText(e));
                        }
                      })();
                    }}
                  >
                    <Camera size={15} strokeWidth={ICON} />
                    Attach screenshot of this page
                  </button>
                </div>
              )}
              <div
                className={`composer ${listening ? "listening" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files.length)
                    void addFiles(e.dataTransfer.files);
                }}
              >
                <textarea
                  ref={composer}
                  aria-label="Message Pact"
                  placeholder={
                    voice === "listening"
                      ? "Listening…"
                      : voice === "transcribing"
                        ? "Transcribing…"
                        : editingMessageId
                          ? "Edit message…"
                          : active?.action?.status === "needs_answer"
                            ? "Reply to Fo…"
                            : "What do you want to get done?"
                  }
                  value={draft}
                  maxLength={8000}
                  rows={1}
                  onFocus={() => {
                    setComposerFocused(true);
                    bumpActivity();
                  }}
                  onBlur={() => setComposerFocused(false)}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    bumpActivity();
                  }}
                  onPaste={(e) => {
                    const files = Array.from(e.clipboardData.files).filter(
                      (f) => isImageMime(f.type) || f.type.startsWith("image/"),
                    );
                    if (!files.length) return;
                    e.preventDefault();
                    void addFiles(files);
                  }}
                  onKeyDown={(e) => {
                    bumpActivity();
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      if (editingMessageId) void confirmEditResend();
                      else void send();
                    }
                  }}
                />
                <div className="composer-actions">
                  <button
                    className="icon-button attach-button"
                    title="Attach"
                    aria-label="Attach"
                    aria-expanded={attachMenu}
                    onClick={() => setAttachMenu((open) => !open)}
                    disabled={
                      busy || attachments.length >= ATTACHMENT_LIMITS.maxFiles
                    }
                  >
                    <Plus size={18} strokeWidth={ICON} />
                  </button>
                  <button
                    className={`icon-button mic-button ${listening ? "active" : ""}`}
                    title={listening ? "Stop dictation" : "Dictate a message"}
                    aria-label={
                      listening ? "Stop dictation" : "Dictate a message"
                    }
                    aria-pressed={listening}
                    onClick={() => void dictate()}
                    disabled={busy}
                  >
                    {listening ? (
                      <AudioLines size={20} strokeWidth={ICON} />
                    ) : (
                      <Mic size={19} strokeWidth={ICON} />
                    )}
                  </button>
                  {busy ? (
                    <button
                      className="send-button stop-button"
                      onClick={stopInterpret}
                      aria-label="Stop generating"
                      title="Stop"
                    >
                      <Square size={14} strokeWidth={ICON} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      className="send-button"
                      disabled={
                        (!draft.trim() && !attachments.length) || capturing
                      }
                      onClick={() =>
                        editingMessageId
                          ? void confirmEditResend()
                          : void send()
                      }
                      aria-label="Send message"
                    >
                      <ArrowUp size={20} strokeWidth={ICON} />
                    </button>
                  )}
                </div>
              </div>
            </footer>
          </>
        )}
      </main>
      {(settingsOpen || sourceOpen || reviewOpen || editorOpen) && (
        <div className="modal-backdrop" onClick={closeDialog}>
          <section
            ref={dialog}
            className={`dialog${settingsOpen ? " settings-dialog" : ""}`}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const items = Array.from(
                dialog.current?.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),a[href],input,select,summary,input[type=color]",
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
                    size={72}
                    state="idle"
                    lively
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
                    {companionSwatchName(draftCompanion.color)}                  </p>
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
                  <button
                    className="primary"
                    onClick={() => void saveCompanion()}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : settingsOpen ? (
              <div className="settings-shell">
                <nav className="settings-nav" aria-label="Settings">
                  {(
                    [
                      ["general", "General", SlidersHorizontal],
                      ["companion", "Companion", User],
                      ["fo", "Fo", Unplug],
                      ["privacy", "Privacy", ShieldCheck],
                      ["about", "About", Info],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      className={settingsSection === id ? "chosen" : ""}
                      onClick={() => setSettingsSection(id)}
                    >
                      <Icon size={16} strokeWidth={ICON} />
                      {label}
                    </button>
                  ))}
                </nav>
                <div className="settings-pane">
                  {settingsSection === "general" && (
                    <>
                      <p className="settings-group-label">Appearance</p>
                      <div className="settings-card">
                        <label className="settings-row">
                          <span>Theme</span>
                          <select
                            aria-label="Theme"
                            value={settings.theme ?? "system"}
                            onChange={(e) =>
                              void persistSettings({
                                theme: e.target.value as ThemePreference,
                              })
                            }
                          >
                            <option value="system">System</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                          </select>
                        </label>
                      </div>
                      <p className="settings-group-label">System</p>
                      <div className="settings-card">
                        <label className="settings-row">
                          <span>Microphone</span>
                          <select
                            aria-label="Microphone"
                            value={settings.micDeviceId ?? "default"}
                            onChange={(e) =>
                              void persistSettings({
                                micDeviceId: e.target.value,
                              })
                            }
                          >
                            <option value="default">System Default</option>
                            {micDevices.map((device) => (
                              <option
                                key={device.deviceId}
                                value={device.deviceId}
                              >
                                {device.label || "Microphone"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="settings-row">
                          <span>Mic access</span>
                          <button
                            type="button"
                            className="settings-chip"
                            onClick={() => void openMicHelp()}
                          >
                            {micGranted ? "Manage" : "Allow"}
                          </button>
                        </div>
                      </div>
                      <p className="settings-group-label">Intelligence</p>
                      <div className="settings-card">
                        <div className="settings-row">
                          <span>Claude</span>
                          <span className="settings-value">
                            {health.aiStatus?.budget.exhausted
                              ? "Paused"
                              : health.ai
                                ? "Available"
                                : "Offline"}
                          </span>
                        </div>
                        <div className="settings-row">
                          <span>Local companion</span>
                          <span className="settings-value">
                            {companionOnline ? "Running" : "Offline"}
                          </span>
                        </div>
                        {health.aiStatus?.model && (
                          <div className="settings-row">
                            <span>Model</span>
                            <span className="settings-value">
                              {health.aiStatus.model === "claude-code-default"
                                ? "Account default"
                                : health.aiStatus.model}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {settingsSection === "companion" && (
                    <>
                      <p className="settings-group-label">Account</p>
                      <div className="settings-card account-card">
                        <div className="account-row">
                          <Companion
                            appearance={companion}
                            dark={darkScheme}
                            size="small"
                          />
                          <span>
                            <strong>Your companion</strong>
                            <small>
                              {
                                SHAPE_OPTIONS.find(
                                  (option) =>
                                    option.shape === companion.shape,
                                )?.name
                              }{" "}
                              · {companionSwatchName(companion.color)}
                            </small>
                          </span>
                          <button
                            type="button"
                            className="settings-chip"
                            onClick={openCompanionEditor}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  {settingsSection === "fo" && (
                    <>
                      <p className="settings-group-label">Connection</p>
                      <div className="settings-card">
                        <div className="account-row">
                          <span className="service-mark">
                            fo<span>↗</span>
                          </span>
                          <span>
                            <strong>Fo by Wajo</strong>
                            <small>
                              {health.fo ? "Connected" : "Not connected"}
                            </small>
                          </span>
                          <span
                            className={`status-light ${health.fo ? "" : "offline"}`}
                          />
                        </div>
                        {authUrl && !health.fo && (
                          <a
                            className="primary full"
                            href={authUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Continue to Wajo
                            <ArrowUpRight size={16} strokeWidth={ICON} />
                          </a>
                        )}
                        {health.fo ? (
                          <div className="settings-actions">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => void connectFo()}
                              disabled={connecting}
                            >
                              Reconnect
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={async () => {
                                try {
                                  await api("/fo/disconnect", {});
                                  setAuthUrl(undefined);
                                  await refreshHealth();
                                } catch (e) {
                                  setError(errorText(e));
                                }
                              }}
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="primary full"
                            disabled={connecting}
                            onClick={() => void connectFo()}
                          >
                            {connecting ? (
                              <Loader2
                                className="spin"
                                size={16}
                                strokeWidth={ICON}
                              />
                            ) : null}
                            Connect
                            <ArrowUpRight size={16} strokeWidth={ICON} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {settingsSection === "privacy" && (
                    <>
                      <p className="settings-group-label">What’s shared</p>
                      <div className="settings-card">
                        <div className="settings-row stacked">
                          <span>Pacts</span>
                          <span className="settings-value">
                            Stay in this browser on your device
                          </span>
                        </div>
                        <div className="settings-row stacked">
                          <span>Page context</span>
                          <span className="settings-value">
                            Read when you ask; sent with your message
                          </span>
                        </div>
                        <div className="settings-row stacked">
                          <span>Attachments</span>
                          <span className="settings-value">
                            Images and text files you attach to a message
                          </span>
                        </div>
                        <div className="settings-row stacked">
                          <span>Fo</span>
                          <span className="settings-value">
                            Only the action you approve
                          </span>
                        </div>
                      </div>
                      <SiteAccessSettings />
                    </>
                  )}
                  {settingsSection === "about" && (
                    <>
                      <p className="settings-group-label">Pact</p>
                      <div className="settings-card">
                        <div className="settings-row">
                          <span>Version</span>
                          <span className="settings-value">{APP_VERSION}</span>
                        </div>
                        <div className="settings-row">
                          <span>Build</span>
                          <span className="settings-value">Hackathon</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
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
                        Pact can see the page information, but this video’s
                        captions aren’t available. Tell Pact what caught your
                        eye.
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
                  onClick={() => readFromPanel("page")}
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
                {active.action.consequential && (
                  <>
                    <p className="setting-description">
                      This can place a real phone call or use an unfamiliar Fo
                      tool. Confirm it separately before sending.
                    </p>
                    <button
                      className="secondary full"
                      onClick={() => setCallConfirmed(true)}
                    >
                      {callConfirmed
                        ? "Separate confirmation recorded"
                        : "Confirm this consequential action"}
                    </button>
                  </>
                )}
                <button
                  className="primary full"
                  disabled={
                    busy || (!!active.action.consequential && !callConfirmed)
                  }
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
      {sectionMenu &&
        (() => {
          const section = sections.find((s) => s.id === sectionMenu.sectionId);
          if (!section) return null;
          return (
            <div
              className="section-menu"
              style={{ left: sectionMenu.x, top: sectionMenu.y }}
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  const name = window.prompt("Rename section", section.name);
                  setSectionMenu(null);
                  if (!name?.trim() || name.trim() === section.name) return;
                  void saveSections(
                    sections.map((s) =>
                      s.id === section.id
                        ? { ...s, name: name.trim().slice(0, 60) }
                        : s,
                    ),
                  );
                }}
              >
                <Pencil size={14} strokeWidth={ICON} />
                <span>Rename section</span>
              </button>
              <button
                type="button"
                className="menu-item danger"
                role="menuitem"
                onClick={() => {
                  setSectionMenu(null);
                  if (
                    !window.confirm(
                      `Delete section “${section.name}”? Pacts stay in the list.`,
                    )
                  )
                    return;
                  void (async () => {
                    await saveSections(
                      sections.filter((s) => s.id !== section.id),
                    );
                    await save(
                      pactsRef.current.map((p) =>
                        p.sectionId === section.id
                          ? { ...p, sectionId: null }
                          : p,
                      ),
                    );
                  })();
                }}
              >
                <Trash2 size={14} strokeWidth={ICON} />
                <span>Delete section</span>
              </button>
            </div>
          );
        })()}
      {menu && menuPact && (
        <PactMenu
          pact={menuPact}
          sections={sections}
          className={menuExiting ? "exiting" : undefined}
          style={{
            position: "fixed",
            left: Math.min(menu.x, window.innerWidth - 220),
            top: Math.min(menu.y, window.innerHeight - 280),
            zIndex: 80,
            ["--origin" as string]: menu.origin,
          }}
          onClose={closeMenu}
          onAction={(action) => void applyPactMenu(menuPact, action)}
        />
      )}
    </div>
  );
}
