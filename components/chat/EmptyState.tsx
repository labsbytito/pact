import { FileText } from "lucide-react";
import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { BlobState } from "../../lib/pact-blob";

export function EmptyState({
  appearance,
  state = "idle",
  title,
  companionName = "Pact",
  onRead,
  chips,
  foConnected,
  pageConnected,
  onOpenConnections,
  onAsk,
}: {
  appearance?: CompanionAppearance;
  state?: BlobState;
  title?: string;
  companionName?: string;
  onRead?: () => void;
  chips: string[];
  foConnected?: boolean;
  pageConnected?: boolean;
  onOpenConnections: () => void;
  onAsk: (text: string) => void;
}) {
  const hello = title
    ? `Hi! I’m ${companionName}. Ask me anything, or share ${title} for context.`
    : `Hi! I’m ${companionName}. What would you like to do?`;
  const tiles = [
    { id: "fo", label: "Fo", connected: Boolean(foConnected), face: <PactBlob size={20} state="still" appearance={appearance} /> },
    { id: "page", label: "This page", connected: Boolean(pageConnected), face: <FileText size={20} strokeWidth={1.75} aria-hidden="true" /> },
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
            <button key={tile.id} className="tool-tile" type="button" onClick={() => { if (tile.id === "page") onRead?.(); else if (!tile.connected) onOpenConnections(); }}>
              <span className="tile-face">{tile.face}<i className={tile.connected ? "dot on" : "dot"} /></span>
              <span className="tile-label">{tile.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
