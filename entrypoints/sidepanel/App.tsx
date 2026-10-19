import { Fragment, useEffect, useRef, useState } from "react";
import { Composer } from "../../components/chat/Composer";
import { EmptyState } from "../../components/chat/EmptyState";
import { Message } from "../../components/chat/Message";
import { StatusLine } from "../../components/chat/StatusLine";
import { Thread } from "../../components/chat/Thread";
import { PactList } from "../../components/library/PactList";
import { Journal } from "../../components/pact/Journal";
import { PactHeader } from "../../components/pact/PactHeader";
import { ProposedRequest } from "../../components/pact/ProposedRequest";
import { ResultCard } from "../../components/pact/ResultCard";
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
import { askChips, hostOf, pageTitle, siteLine, type PageLabel } from "../../lib/suggestions";
import { companionThinking, pactStep } from "../../lib/step";

export default function App() {
  const { pacts, activeId, setActiveId, settings, savePact, updateSettings, clearPacts } = useVault();
  const { link, refresh } = useHealth();
  const turn = useTurn(savePact);
  const [source, setSource] = useState<Source | undefined>();
  const [view, setView] = useState<"home" | "list" | "settings">("home");
  const [glass, setGlass] = useState(false);
  const [wide, setWide] = useState(false);
  const [blob, setBlob] = useState<BlobState>("idle");
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState<PageLabel>();
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
  const status = active?.action?.status;
  const step = pactStep({ reading, streaming: turn.streaming, status });
  const thinking = companionThinking({ reading, streaming: turn.streaming, status });
  const state: BlobState = link.kind === "offline" ? "sleepy" : thinking ? "thinking" : blob;
  const caption = pageTitle(page) || active?.source?.title || "";
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
  return (
    <div className="app">
      <PactHeader
        title={view === "settings" ? "Settings" : view === "list" ? "Pacts" : active?.title || "Pact"}
        caption={view === "home" ? caption : ""}
        live={view !== "home" || Boolean(active)}
        state={state}
        appearance={settings.companion}
        demo={!!health?.demo}
        glass={glass}
        onBack={view === "list" ? () => setView("home") : undefined}
        onList={view === "home" ? () => setView("list") : undefined}
        onSettings={() => setView(view === "settings" ? "home" : "settings")}
      />
      <div className="scroll" onScroll={(event) => setGlass(event.currentTarget.scrollTop > 4)}>
        {link.kind === "loading" && view !== "settings" ? (
          <p className="site-line">Opening Pact…</p>
        ) : !ready && view !== "settings" ? (
          <ServerState kind={link.kind === "unconfigured" ? "unconfigured" : link.kind === "limited" ? "limited" : "offline"} model={link.kind === "unconfigured" ? link.model : undefined} dev={import.meta.env.DEV} appearance={settings.companion} onRetry={() => void refresh()} onConnect={() => void connect()} />
        ) : view === "settings" ? (
          <SettingsSheet settings={settings} onChange={updateSettings} onClose={() => setView("home")} fo={health?.fo} wide={wide} onRefresh={() => void refresh()} onDeleted={() => void deleted()} />
        ) : view === "list" ? (
          <PactList pacts={pacts.filter((item) => !item.archived)} onOpen={(id) => { setActiveId(id); setView("home"); }} />
        ) : !active ? (
          <EmptyState appearance={settings.companion} site={siteLine(page)} chips={askChips(page)} onRead={() => void readPage()} onAsk={turn.setDraft} />
        ) : (
          <Home active={active} streaming={turn.streaming} step={step} busy={turn.busy} signedOut={link.kind === "fo"} onConnect={() => void connect()} onApprove={(pact) => void turn.approve(pact).then((next) => next && setActiveId(next.id))} onCancel={(pact) => void turn.cancel(pact)} onRetry={(text) => void turn.send(active, active?.source ?? source, text)} />
        )}
        {turn.note && <p className="note">{turn.note}</p>}
      </div>
      {view !== "settings" && ready && view !== "list" && (
        <>
          {(active?.source ?? source) && <SourceChip source={(active?.source ?? source)!} />}
          <Composer value={turn.draft} onChange={turn.setDraft} onSend={send} onStop={turn.stop} streaming={turn.streaming} onRead={() => void readPage()} onDictate={() => void voice.dictate()} />
        </>
      )}
    </div>
  );
}

function Home({ active, streaming, step, busy, signedOut, onConnect, onApprove, onCancel, onRetry }: {
  active: Pact;
  streaming: boolean;
  step: string;
  busy: boolean;
  signedOut: boolean;
  onConnect: () => void;
  onApprove: (pact: Pact) => void;
  onCancel: (pact: Pact) => void;
  onRetry: (text: string) => void;
}) {
  const action = active.action;
  const runs = (active.actions ?? []).filter((item) => item.status === "returned" && item.result);
  let shown = 0;
  const lastUser = [...active.messages].reverse().find((item) => item.role === "user")?.text;
  return (
    <>
      <Thread>
        {active.messages.map((item, index) => {
          const next = active.messages[index + 1];
          const result = item.role === "assistant" && (!next || next.role === "user") ? runs[shown] : undefined;
          if (result) shown += 1;
          return (
            <Fragment key={item.id}>
              {item.text && <Message role={item.role} text={item.text} at={item.at} stopped={item.stopped} onRetry={item.stopped && lastUser ? () => onRetry(lastUser) : undefined} />}
              {result?.result && <ResultCard text={result.result} />}
            </Fragment>
          );
        })}
      </Thread>
      {step && <StatusLine text={step} />}
      {streaming && !step && <StatusLine text="Writing a reply…" />}
      {action?.status === "needs_answer" && action.result && <p className="meta">{action.result}</p>}
      {action?.status === "needs_answer" && <p className="meta">Reply below and Fo will continue this conversation.</p>}
      {action?.status === "proposed" && <ProposedRequest action={action} busy={busy || streaming} signedOut={signedOut} onApprove={() => onApprove(active)} onCancel={() => onCancel(active)} onConnect={onConnect} />}
      <Journal actions={active.actions ?? []} />
    </>
  );
}
