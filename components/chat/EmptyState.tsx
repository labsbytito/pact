import { useEffect, useState } from "react";
import { CalendarDays, FileText, Mail } from "lucide-react";
import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import { loadFoStatus } from "../../lib/backend";
import type { BlobState } from "../../lib/pact-blob";

export function EmptyState({
  appearance,
  state = "idle",
  title,
  chips,
  foConnected,
  pageConnected,
  onOpenConnections,
  onAsk,
}: {
  appearance?: CompanionAppearance;
  state?: BlobState;
  title?: string;
  chips: string[];
  foConnected?: boolean;
  pageConnected?: boolean;
  onOpenConnections: () => void;
  onAsk: (text: string) => void;
}) {
  const [gmail, setGmail] = useState(false);
  const [calendar, setCalendar] = useState(false);
  useEffect(() => {
    let stop = false;
    void loadFoStatus()
      .then((body) => {
        if (stop) return;
        const names = (body.tools ?? []).map((tool) => tool.name);
        setGmail(names.some((name) => /gmail|google.?mail/i.test(name)));
        setCalendar(names.some((name) => /calendar/i.test(name)));
      })
      .catch(() => {
        if (!stop) {
          setGmail(false);
          setCalendar(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [foConnected]);
  const hello = title
    ? `Hi! I'm Pact. You're on ${title}, want me to plan a visit?`
    : "Hi! I'm Pact. Open a page, and I'll meet you there.";
  const tiles = [
    { id: "fo", label: "Fo", connected: Boolean(foConnected), face: <PactBlob size={20} state="still" appearance={appearance} /> },
    { id: "page", label: "This page", connected: Boolean(pageConnected), face: <FileText size={20} strokeWidth={1.75} aria-hidden="true" /> },
    { id: "gmail", label: "Gmail", connected: gmail, face: <Mail size={20} strokeWidth={1.75} aria-hidden="true" /> },
    { id: "calendar", label: "Calendar", connected: calendar, face: <CalendarDays size={20} strokeWidth={1.75} aria-hidden="true" /> },
  ];
  return (
    <div className="empty">
      <PactBlob state={state} size={72} live appearance={appearance} label="Pact" />
      <div className="msg assistant">
        <div className="bubble assistant">{hello}</div>
      </div>
      <div className="ask-row">
        {chips.slice(0, 2).map((chip) => (
          <button key={chip} className="ask-chip glass" type="button" onClick={() => onAsk(chip)}>{chip}</button>
        ))}
      </div>
      <section className="can-use">
        <p>Pact can use</p>
        <div className="tool-row" aria-label="Pact can use">
          {tiles.map((tile) => (
            <button key={tile.id} className="tool-tile" type="button" onClick={() => { if (!tile.connected) onOpenConnections(); }}>
              <span className="tile-face">{tile.face}<i className={tile.connected ? "dot on" : "dot"} /></span>
              <span className="tile-label">{tile.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
