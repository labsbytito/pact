import { useEffect, useRef, useState } from "react";
import { Composer } from "../../components/chat/Composer";
import { EmptyState } from "../../components/chat/EmptyState";
import { LivePill } from "../../components/chat/LivePill";
import { Transcript } from "../../components/chat/Transcript";
import { PactList } from "../../components/library/PactList";
import { PactHeader } from "../../components/pact/PactHeader";
import { SourceChip } from "../../components/pact/SourceChip";
import { SettingsSheet } from "../../components/settings/SettingsSheet";
import { ServerState } from "../../components/system/ServerState";
import { useDictation } from "../../hooks/useDictation";
import { useHealth } from "../../hooks/useHealth";
import { useTheme } from "../../hooks/useTheme";
import { useTurn } from "../../hooks/useTurn";
import { useVault } from "../../hooks/useVault";
import { clearInstallToken } from "../../lib/api";
import { connectFo } from "../../lib/backend";
import { capturePage } from "../../lib/capture";
import type { Pact, Source } from "../../lib/model";
import type { BlobState } from "../../lib/pact-blob";
import { shouldGreet } from "../../lib/pact-blob";
import { currentPageLabel } from "../../lib/page-label";
import { askChips, hostOf, pageTitle, type PageLabel } from "../../lib/suggestions";
import { companionThinking, liveLine } from "../../lib/step";

export default function App() {
  const { pacts, activeId, setActiveId, settings, savePact, updateSettings, clearPacts } = useVault();
  const { link, refresh } = useHealth();
  const turn = useTurn(savePact);
  const [source, setSource] = useState<Source | undefined>();
  const [view, setView] = useState<"home" | "list" | "settings">("home");
  const [wide, setWide] = useState(false);
  const [blob, setBlob] = useState<BlobState>("idle");
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState<PageLabel>();
  const hopped = useRef<string | null>(null);
  const active = pacts.find((item) => item.id === activeId) ?? null;
  const ready = link.kind === "ok" || link.kind === "fo";
  const health = ready ? link.health : undefined;
  const voice = useDictation(settings.micDeviceId, turn.setDraft, turn.setNote);
  const watchRef = useRef(turn.watch);
  watchRef.current = turn.watch;
  useTheme(settings.theme, settings.accent, settings.companion?.color, settings.motion);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 420px)");
    const apply = () => setWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    void shouldGreet().then((greet) => { if (greet) setBlob("greeting"); });
    void currentPageLabel().then(setPage);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    const action = active?.action;
    if (!active || !action?.runId) return;
    if (action.status !== "running" && action.status !== "approved") return;
    watchRef.current(active, action.runId);
  }, [active?.id, active?.action?.runId, active?.action?.status]);
  useEffect(() => {
    if (blob !== "greeting") return;
    const timer = window.setTimeout(() => setBlob("idle"), 700);
    return () => window.clearTimeout(timer);
  }, [blob]);
  useEffect(() => {
    const action = active?.action;
    if (!action || action.status !== "returned" || hopped.current === action.id) return;
    hopped.current = action.id;
    setBlob("happy");
    const timer = window.setTimeout(() => setBlob((current) => (current === "happy" ? "idle" : current)), 900);
    return () => window.clearTimeout(timer);
  }, [active?.action?.id, active?.action?.status]);
  const status = active?.action?.status;
  const thinking = companionThinking({ reading, streaming: turn.streaming, status });
  const typing = Boolean(turn.draft.trim()) && !turn.streaming && !reading;
  const state: BlobState = link.kind === "offline" ? "sleepy" : thinking ? "thinking" : typing ? "listening" : blob;
  const line = liveLine({ reading, streaming: turn.streaming, status, hasPage: Boolean(pageTitle(page) || source) });
  async function connect() {
    try {
      const result = await connectFo();
      if (result.url) await chrome.tabs.create({ url: result.url });
      void refresh();
    } catch (error) {
      turn.setNote(error instanceof Error ? error.message : "Pact couldn't connect to Fo.");
    }
  }
  async function deleted() {
    await clearInstallToken();
    clearPacts();
    setActiveId(null);
    setView("home");
    void refresh();
  }
  async function readPage() {
    setReading(true);
    try {
      const next = await capturePage("page");
      setSource(next);
      setPage({ title: next.title, url: next.url, host: hostOf(next.url) });
      turn.setNote("");
      setView("home");
    } catch (error) {
      turn.setNote(error instanceof Error ? error.message : "Pact could not read this page.");
    } finally {
      setReading(false);
    }
  }
  function send() {
    void turn.send(active, source ?? active?.source, turn.draft, (created) => setActiveId(created.id));
  }
  const showComposer = view === "home" && ready;
  const title = view === "settings" ? "Settings" : view === "list" ? "Pacts" : active?.title || "Pact";
  return (
    <div className={showComposer ? "app with-composer" : "app"}>
      <div className="scroll">
        <PactHeader
          title={title}
          live={link.kind !== "offline"}
          state={state}
          appearance={settings.companion}
          onBack={view === "home" ? undefined : () => setView("home")}
          onList={view === "home" ? () => setView("list") : undefined}
          onSettings={() => setView(view === "settings" ? "home" : "settings")}
        />
        <div className="pane">
          {link.kind === "loading" && view !== "settings" ? (
            <p className="site-line">Opening Pact…</p>
          ) : !ready && view !== "settings" ? (
            <ServerState kind={link.kind === "unconfigured" ? "unconfigured" : link.kind === "limited" ? "limited" : "offline"} model={link.kind === "unconfigured" ? link.model : undefined} dev={import.meta.env.DEV} appearance={settings.companion} onRetry={() => void refresh()} onConnect={() => void connect()} />
          ) : view === "settings" ? (
            <SettingsSheet settings={settings} onChange={updateSettings} onClose={() => setView("home")} fo={health?.fo} wide={wide} demo={!!health?.demo} onRefresh={() => void refresh()} onDeleted={() => void deleted()} />
          ) : view === "list" ? (
            <PactList pacts={pacts.filter((item) => !item.archived)} onOpen={(id) => { setActiveId(id); setView("home"); }} />
          ) : !active ? (
            <EmptyState appearance={settings.companion} state={state} title={pageTitle(page)} chips={askChips(page)} foConnected={health?.fo === "signed in"} pageConnected={Boolean(pageTitle(page) || source)} pageMark={page?.host?.slice(0, 1).toUpperCase()} onConnect={() => void connect()} onRead={() => void readPage()} onAsk={turn.setDraft} />
          ) : (
            <Transcript active={active} busy={turn.busy || turn.streaming} signedOut={link.kind === "fo"} appearance={settings.companion} onConnect={() => void connect()} onApprove={(pact) => void turn.approve(pact).then((next) => next && setActiveId(next.id))} onCancel={(pact) => void turn.cancel(pact)} onRetry={(text) => void turn.send(active, active.source ?? source, text)} onEdit={turn.setDraft} />
          )}
          {turn.note && <p className="note">{turn.note}</p>}
        </div>
      </div>
      {showComposer && (
        <div className="dock">
          {(active?.source ?? source) && <SourceChip source={(active?.source ?? source)!} />}
          <LivePill text={line} state={state} appearance={settings.companion} demo={!!health?.demo} />
          <Composer value={turn.draft} onChange={turn.setDraft} onSend={send} onStop={turn.stop} streaming={turn.streaming} onRead={() => void readPage()} onDictate={() => void voice.dictate()} />
        </div>
      )}
    </div>
  );
}
