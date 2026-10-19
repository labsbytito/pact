import { useEffect, useState } from "react";
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
import { RunStatus } from "../../components/pact/RunStatus";
import { SourceChip } from "../../components/pact/SourceChip";
import { SettingsSheet } from "../../components/settings/SettingsSheet";
import { ServerState } from "../../components/system/ServerState";
import { useHealth } from "../../hooks/useHealth";
import { useTheme } from "../../hooks/useTheme";
import { useTurn } from "../../hooks/useTurn";
import { useVault } from "../../hooks/useVault";
import { capturePage } from "../../lib/capture";
import type { Pact, Source } from "../../lib/model";
import type { BlobState } from "../../lib/pact-blob";
import { shouldGreet } from "../../lib/pact-blob";
import { currentPageLabel } from "../../lib/page-label";
import { askChips, hostOf, siteLine, type PageLabel } from "../../lib/suggestions";
import { companionThinking, pactStep } from "../../lib/step";

export default function App() {
  const { pacts, settings, savePact, updateSettings } = useVault();
  const { link, refresh } = useHealth();
  const turn = useTurn(savePact);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [source, setSource] = useState<Source | undefined>();
  const [view, setView] = useState<"home" | "list" | "settings">("home");
  const [glass, setGlass] = useState(false);
  const [wide, setWide] = useState(false);
  const [blob, setBlob] = useState<BlobState>("idle");
  const [reading, setReading] = useState(false);
  const [page, setPage] = useState<PageLabel>();
  const active = pacts.find((item) => item.id === activeId) ?? null;
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
    if (blob !== "greeting") return;
    const timer = window.setTimeout(() => setBlob("idle"), 700);
    return () => window.clearTimeout(timer);
  }, [blob]);
  const status = active?.action?.status;
  const step = pactStep({ reading, streaming: turn.streaming, status });
  const thinking = companionThinking({ reading, streaming: turn.streaming, status });
  const state: BlobState = link.kind === "offline" ? "sleepy" : thinking ? "thinking" : blob;
  const caption = step || page?.host || "Here with you.";
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
  async function send() {
    const next = await turn.send(active, source, turn.draft);
    if (next) setActiveId(next.id);
  }
  function dictate() {
    const Rec = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Rec) { turn.setNote("Dictation isn’t available in this browser. You can still type."); return; }
    const rec = new Rec();
    rec.onresult = (event) => turn.setDraft(event.results[0]?.[0]?.transcript ?? turn.draft);
    rec.start();
  }
  return (
    <div className="app">
      <PactHeader
        title={view === "settings" ? "Settings" : active?.title || "Pact"}
        caption={caption}
        live={view !== "home" || Boolean(active)}
        state={state}
        appearance={settings.companion}
        demo={link.kind === "ok" && !!link.health.demo}
        glass={glass}
        onBack={view === "home" && active ? () => setView("list") : view !== "home" ? () => setView("home") : undefined}
        onSettings={() => setView(view === "settings" ? "home" : "settings")}
      />
      <div className="scroll" onScroll={(event) => setGlass(event.currentTarget.scrollTop > 4)}>
        {link.kind !== "ok" && view !== "settings" ? (
          <ServerState kind={link.kind === "unconfigured" ? "unconfigured" : link.kind} model={link.kind === "unconfigured" ? link.model : undefined} dev={import.meta.env.DEV} appearance={settings.companion} onRetry={() => void refresh()} />
        ) : view === "settings" ? (
          <SettingsSheet settings={settings} onChange={updateSettings} onClose={() => setView("home")} fo={link.kind === "ok" ? link.health.fo : undefined} wide={wide} />
        ) : view === "list" ? (
          <PactList pacts={pacts.filter((item) => !item.archived)} onOpen={(id) => { setActiveId(id); setView("home"); }} />
        ) : (
          <Home active={active} source={active?.source ?? source} page={page} caption={step} appearance={settings.companion} streaming={turn.streaming} onRead={() => void readPage()} onAsk={turn.setDraft} onApprove={(pact) => void turn.approve(pact).then((next) => next && setActiveId(next.id))} onCancel={(pact) => void turn.cancel(pact)} onRetry={(text) => void turn.send(active, active?.source ?? source, text)} />
        )}
        {turn.note && <p className="note">{turn.note}</p>}
      </div>
      {view !== "settings" && link.kind === "ok" && view !== "list" && (
        <Composer value={turn.draft} onChange={turn.setDraft} onSend={() => void send()} onStop={turn.stop} streaming={turn.streaming} onRead={() => void readPage()} onDictate={dictate} />
      )}
    </div>
  );
}

function Home({ active, source, page, caption, streaming, appearance, onRead, onAsk, onApprove, onCancel, onRetry }: {
  active: Pact | null;
  source?: Source;
  page?: PageLabel;
  caption: string;
  streaming: boolean;
  appearance?: { shape: number; color: string };
  onRead: () => void;
  onAsk: (text: string) => void;
  onApprove: (pact: Pact) => void;
  onCancel: (pact: Pact) => void;
  onRetry: (text: string) => void;
}) {
  if (!active) return <EmptyState appearance={appearance} caption={caption} site={siteLine(page)} chips={askChips(page)} onRead={onRead} onAsk={onAsk} />;
  const action = active.action;
  const lastUser = [...active.messages].reverse().find((item) => item.role === "user")?.text;
  return (
    <>
      {source && <SourceChip source={source} />}
      <Thread>
        {active.messages.map((item) => item.text && <Message key={item.id} role={item.role} text={item.text} at={item.at} stopped={item.stopped} onRetry={item.stopped && lastUser ? () => onRetry(lastUser) : undefined} />)}
      </Thread>
      {streaming && <StatusLine text={caption || "Writing a reply…"} />}
      {action?.status === "proposed" && <ProposedRequest action={action} busy={false} onApprove={() => onApprove(active)} onCancel={() => onCancel(active)} />}
      {action && <RunStatus action={action} appearance={appearance} />}
      {action?.status === "returned" && action.result && <ResultCard text={action.result} />}
      <Journal actions={active.actions ?? []} />
    </>
  );
}

type SpeechRec = { start: () => void; onresult: (event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void };
