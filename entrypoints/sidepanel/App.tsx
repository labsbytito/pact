import { useEffect, useRef, useState } from "react";
import { Composer } from "../../components/chat/Composer";
import { EmptyState } from "../../components/chat/EmptyState";
import { LivePill } from "../../components/chat/LivePill";
import { Transcript } from "../../components/chat/Transcript";
import { PactList } from "../../components/library/PactList";
import { PactHeader } from "../../components/pact/PactHeader";
import { SettingsSheet, type SettingsPage } from "../../components/settings/SettingsSheet";
import { ReachBanner } from "../../components/system/ReachBanner";
import { ServerState } from "../../components/system/ServerState";
import { useDictation } from "../../hooks/useDictation";
import { useHealth } from "../../hooks/useHealth";
import { useTheme } from "../../hooks/useTheme";
import { useTurn } from "../../hooks/useTurn";
import { useVault } from "../../hooks/useVault";
import { clearInstallToken } from "../../lib/api";
import { connectFo } from "../../lib/backend";
import { capturePage } from "../../lib/capture";
import type { Source } from "../../lib/model";
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
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("General");
  const [navWide, setNavWide] = useState(false);
  const [blob, setBlob] = useState<BlobState>("idle");
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState<PageLabel>();
  const hopped = useRef<string | null>(null);
  const active = pacts.find((item) => item.id === activeId) ?? null;
  const ready = link.kind === "ok" || link.kind === "fo";
  const health = ready ? link.health : undefined;
  const signedOut = link.kind === "fo";
  const voice = useDictation(settings.micDeviceId, turn.setDraft, turn.setNote);
  const watchRef = useRef(turn.watch);
  const recoverRef = useRef(turn.recover);
  watchRef.current = turn.watch;
  recoverRef.current = turn.recover;
  turn.prefs.current = {
    responseStyle: settings.responseStyle,
    askBefore: settings.askBefore,
    signedOut,
  };
  useTheme(settings.theme, settings.accent, settings.companion?.color, settings.motion, settings.background, settings.textSize);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 480px)");
    const apply = () => setNavWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    void shouldGreet().then((greet) => { if (greet) setBlob("greeting"); });
    void currentPageLabel().then(setPage);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    const action = active?.action;
    if (!active || !action) return;
    if (action.runId && (action.status === "running" || action.status === "approved")) {
      watchRef.current(active, action.runId);
      return;
    }
    if (action.planId && (action.status === "running" || action.status === "approved"))
      void recoverRef.current(active);
  }, [active?.id, active?.action?.runId, active?.action?.status, active?.action?.planId]);
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
  const resting = blob === "idle" ? settings.companion?.mood ?? "idle" : blob;
  const state: BlobState = link.kind === "offline" ? "sleepy" : thinking ? "thinking" : typing ? "listening" : resting;
  const title = pageTitle(page) || source?.title || "";
  const line = liveLine({ reading, streaming: turn.streaming, status, hasPage: Boolean(title), page: title });
  const working = Boolean(reading || turn.streaming || status === "approved" || status === "running");
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
  function openConnections() {
    setSettingsPage("Connections");
    setView("settings");
  }
  const down = link.kind === "offline" || link.kind === "limited" || link.kind === "unconfigured";
  const showComposer = view === "home" && (ready || Boolean(active));
  function retryReply() {
    const text = [...(active?.messages ?? [])].reverse().find((item) => item.role === "user")?.text ?? "";
    if (text) void turn.send(active, active?.source ?? source, text, undefined, true);
  }
  const heading = view === "settings" ? "Settings" : view === "list" ? "Pacts" : active?.title || "Pact";
  return (
    <div className={showComposer ? "app with-composer" : "app"}>
      <PactHeader
        title={heading}
        live={link.kind !== "offline"}
        state={state}
        appearance={settings.companion}
        onBack={view === "home" ? undefined : () => setView("home")}
        onList={view === "home" ? () => setView("list") : undefined}
        onSettings={view === "home" ? () => { setSettingsPage("General"); setView("settings"); } : undefined}
      />
      <div className="scroll">
        <div className="pane">
          {view === "settings" ? (
            <SettingsSheet settings={settings} onChange={updateSettings} fo={health?.fo} navWide={navWide} page={settingsPage} onPage={setSettingsPage} onRefresh={() => void refresh()} onDeleted={() => void deleted()} demo={!!health?.demo} />
          ) : view === "list" ? (
            <>
              {down && <ReachBanner title="Can’t reach Pact" detail="Your Pacts are still saved on this computer." onRetry={() => void refresh()} />}
              <PactList pacts={pacts.filter((item) => !item.archived)} appearance={settings.companion} onOpen={(id) => { setActiveId(id); setView("home"); }} />
            </>
          ) : link.kind === "loading" && !active ? (
            <p className="site-line">Opening Pact…</p>
          ) : down && !active ? (
            <ServerState kind={link.kind === "unconfigured" ? "unconfigured" : link.kind === "limited" ? "limited" : "offline"} model={link.kind === "unconfigured" ? link.model : undefined} dev={import.meta.env.DEV} appearance={settings.companion} onRetry={() => void refresh()} onConnect={() => void connect()} />
          ) : !active ? (
            <EmptyState appearance={settings.companion} state={state} title={pageTitle(page)} chips={askChips(page)} foConnected={health?.fo === "signed in"} pageConnected={Boolean(title)} onOpenConnections={openConnections} onAsk={turn.setDraft} />
          ) : (
            <>
              {down && <ReachBanner title="Can’t reach Pact" detail="Your conversation is still here." onRetry={() => void refresh()} />}
              <Transcript active={active} busy={turn.busy} streaming={turn.streaming} signedOut={signedOut} appearance={settings.companion} onConnect={() => void connect()} onApprove={(pact) => void turn.approve(pact)} onCancel={(pact) => void turn.cancel(pact)} onRetry={(text) => void turn.send(active, active.source ?? source, text)} onEdit={turn.setDraft} />
              {turn.replyError && <ReachBanner title={turn.replyError} onRetry={retryReply} />}
            </>
          )}
          {turn.note && <p className="note">{turn.note}</p>}
        </div>
      </div>
      {showComposer && (
        <div className="dock">
          <LivePill text={line} state={state} appearance={settings.companion} demo={!!health?.demo} working={working} />
          <Composer value={turn.draft} onChange={turn.setDraft} onSend={send} onStop={turn.stop} streaming={turn.streaming} onRead={() => void readPage()} onDictate={() => void voice.dictate()} sendWithEnter={settings.sendWithEnter !== false} />
        </div>
      )}
    </div>
  );
}
