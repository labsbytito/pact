import { useEffect, useRef, useState } from "react";
import { NewPact } from "../../components/library/NewPact";
import { makePact } from "../../lib/model";
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
import { requestSiteRead, sitePatternFromUrl } from "../../lib/site-access";
import { currentPageLabel } from "../../lib/page-label";
import { askChips, hostOf, pageTitle, type PageLabel } from "../../lib/suggestions";
import { companionThinking, liveLine } from "../../lib/step";

export default function App() {
  const { pacts, activeId, setActiveId, settings, savePact, updateSettings, clearPacts, change, storageError } = useVault();
  const { link, refresh } = useHealth();
  const turn = useTurn(savePact);
  const [creating, setCreating] = useState(false);
  const [source, setSource] = useState<Source | undefined>();
  const [view, setView] = useState<"home" | "list" | "settings">("home");
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("General");
  const [navWide, setNavWide] = useState(false);
  const [blob, setBlob] = useState<BlobState>("idle");
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState<PageLabel>();
  const hopped = useRef<string | null>(null);
  const active = pacts.find((item) => item.id === activeId && !item.deletedAt) ?? null;
  const appearance = active?.companion?.appearance ?? settings.companion;
  const ready = link.kind === "ok" || link.kind === "fo";
  const health = ready ? link.health : undefined;
  const signedOut = link.kind === "fo";
  const voice = useDictation(settings.micDeviceId, turn.setDraft, turn.setNote);
  const watchRef = useRef(turn.watch);
  const recoverRef = useRef(turn.recover);
  watchRef.current = turn.watch;
  recoverRef.current = turn.recover;
  turn.companion.current = { name: "Pact", appearance: settings.companion ?? { shape: 0, color: "#F59E0B", v: 2 } };
  turn.prefs.current = {
    responseStyle: settings.responseStyle,
    askBefore: settings.askBefore,
    signedOut,
  };
  useTheme(settings.theme, settings.accent, appearance?.color, settings.motion, settings.background, settings.textSize);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 480px)");
    const apply = () => setNavWide(media.matches);
    apply();
    media.addEventListener("change", apply);
    void shouldGreet().then((greet) => { if (greet) setBlob("greeting"); });
    void currentPageLabel().then(setPage);
    const onInvocation = (message: { type?: string }) => {
      if (message.type === "pact-invocation") void currentPageLabel().then(setPage);
    };
    chrome.runtime?.onMessage?.addListener(onInvocation);
    return () => { media.removeEventListener("change", apply); chrome.runtime?.onMessage?.removeListener(onInvocation); };

  }, []);
  useEffect(() => {
    const action = active?.action;
    if (!active || !action) return;
    if (action.runId && (action.status === "running" || action.status === "approved")) {
      watchRef.current(active, action.runId);
      return;
    }
    if (action.requestId && action.planId && !action.runId && (action.status === "running" || action.status === "approved"))
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
  const title = (active?.source ?? source)?.title || "";
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
    turn.reset();
    await clearInstallToken();
    clearPacts();
    setActiveId(null);
    setView("home");
    void refresh();
  }
  function requestPage(afterText?: string) {
    // Start permission request synchronously from the click.
    const granted = requestSiteRead(sitePatternFromUrl(page?.url));
    void granted.then((ok) => { if (ok) void readPage(afterText); else turn.setNote("Page access was not allowed. You can still chat or attach a file."); }).catch((e) => turn.setNote(e.message));
  }
  async function readPage(afterText?: string) {
    setReading(true);
    try {
      const next = await capturePage("page");
      setSource(next);
      if (active) savePact({ ...active, source: next });
      setPage({ title: next.title, url: next.url, host: hostOf(next.url) });
      turn.setNote("");
      setView("home");
      if (afterText) void turn.send(active, next, afterText, (created) => setActiveId(created.id));
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
  const showComposer = !creating && view === "home" && (ready || Boolean(active));
  function retryReply() {
    const text = [...(active?.messages ?? [])].reverse().find((item) => item.role === "user")?.text ?? "";
    if (text) void turn.send(active, active?.source ?? source, text, undefined, true);
  }
  const heading = creating ? "New Pact" : view === "settings" ? "Settings" : view === "list" ? "Pacts" : active?.title || "Pact";
  return (
    <div className={showComposer ? "app with-composer" : "app"}>
      <PactHeader
        title={heading}
        live={link.kind !== "offline"}
        state={state}
        appearance={appearance}
        onBack={view === "home" ? undefined : () => setView("home")}
        onList={view === "home" ? () => setView("list") : undefined}
        onSettings={view === "home" ? () => { setSettingsPage("General"); setView("settings"); } : undefined}
      />
      <div className="scroll">
        <div className="pane">
          {creating ? <NewPact initial={settings.companion} onCancel={() => setCreating(false)} onCreate={(companion) => { const pact = makePact("New Pact", undefined, pacts, companion); pact.messages = []; savePact(pact); setActiveId(pact.id); turn.setDraft(""); turn.setAttachments([]); setSource(undefined); setCreating(false); setView("home"); }} /> : view === "settings" ? (
            <SettingsSheet settings={settings} onChange={updateSettings} fo={health?.fo} navWide={navWide} page={settingsPage} onPage={setSettingsPage} onRefresh={() => void refresh()} onDeleted={() => void deleted()} demo={!!health?.demo} />
          ) : view === "list" ? (
            <>
              {link.kind === "offline" && <ReachBanner title="Can’t reach Pact" detail="Your Pacts are still saved on this computer." onRetry={() => void refresh()} />}
              <PactList pacts={pacts} activeId={activeId} appearance={appearance} onChange={change} onNew={() => { setCreating(true); setView("home"); }} onOpen={(id) => { turn.setAttachments([]); turn.setDraft(""); setSource(undefined); setActiveId(id); setView("home"); }} />
            </>
          ) : link.kind === "loading" && !active ? (
            <p className="site-line">Opening Pact…</p>
          ) : down && !active && link.kind !== "offline" ? (
            <ServerState kind={link.kind === "unconfigured" ? "unconfigured" : "limited"} model={link.kind === "unconfigured" ? link.model : undefined} dev={import.meta.env.DEV} appearance={appearance} onRetry={() => void refresh()} onConnect={() => void connect()} />
          ) : !active || !active.messages.length ? (
            <>
              {link.kind === "offline" && <ReachBanner title="Can’t reach Pact" detail="Your Pacts are still saved on this computer." onRetry={() => void refresh()} />}
              <EmptyState companionName={active?.companion?.name} onRead={() => requestPage()} onSummarize={() => requestPage("Summarize this page")} appearance={appearance} state={state} title={pageTitle(page)} chips={askChips(page)} foConnected={health?.fo === "signed in"} pageConnected={Boolean(title)} onOpenConnections={openConnections} onAsk={turn.setDraft} />
            </>
          ) : (
            <>
              {link.kind === "offline" && <ReachBanner title="Can’t reach Pact" detail="Your conversation is still here." onRetry={() => void refresh()} />}
              {down && link.kind !== "offline" && <ReachBanner title={link.kind === "limited" ? "Pact needs a short break" : "Pact isn’t ready yet"} detail="Your conversation is still here." onRetry={() => void refresh()} />}
              <Transcript active={active} busy={turn.busy} streaming={turn.streaming} signedOut={signedOut} appearance={appearance} onConnect={() => void connect()} onApprove={(pact) => void turn.approve(pact)} onCancel={(pact) => void turn.cancel(pact)} onRetry={(text) => void turn.send(active, active.source ?? source, text)} onEdit={turn.setDraft} />
              {turn.replyError && <ReachBanner title={turn.replyError} onRetry={retryReply} />}
            </>
          )}
          {storageError && <p className="note" role="alert">{storageError}</p>}
          {turn.note && <p className="note">{turn.note}</p>}
        </div>
      </div>
      {showComposer && (
        <div className="dock">
          <LivePill text={line} state={state} appearance={appearance} demo={!!health?.demo} working={working} />
          <Composer value={turn.draft} onChange={turn.setDraft} onSend={send} onStop={turn.stop} streaming={turn.streaming} onRead={requestPage} attachments={turn.attachments} onAttachments={turn.setAttachments} onDictate={() => void voice.dictate()} sendWithEnter={settings.sendWithEnter !== false} />
        </div>
      )}
    </div>
  );
}
