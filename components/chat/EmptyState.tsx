import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { BlobState } from "../../lib/pact-blob";

export function EmptyState({
  appearance,
  state = "idle",
  title,
  chips,
  foConnected,
  pageConnected,
  pageMark,
  onConnect,
  onRead,
  onAsk,
}: {
  appearance?: CompanionAppearance;
  state?: BlobState;
  title?: string;
  chips: string[];
  foConnected?: boolean;
  pageConnected?: boolean;
  pageMark?: string;
  onConnect: () => void;
  onRead: () => void;
  onAsk: (text: string) => void;
}) {
  const hello = title
    ? `Hi, I'm Pact. You're on ${title}. Want me to plan the visit?`
    : "Hi, I'm Pact. Open a page, and I'll meet you there.";
  return (
    <div className="empty">
      <PactBlob state={state} size={72} live appearance={appearance} label="Pact" />
      <div className="msg assistant">
        <div className="bubble assistant">{hello}</div>
      </div>
      <div className="ask-row">
        <button className="ask-chip" type="button" onClick={onRead}>Read this page</button>
        {chips.slice(0, 1).map((chip) => (
          <button key={chip} className="ask-chip" type="button" onClick={() => onAsk(chip)}>{chip}</button>
        ))}
      </div>
      <div className="tool-row" aria-label="Connected tools">
        <button className="tool-tile" type="button" onClick={onConnect}>
          <span className="tile-face">Fo<i className={foConnected ? "dot on" : "dot"} /></span>
          <span className="tile-label">{foConnected ? "Fo" : "Connect"}</span>
        </button>
        <button className="tool-tile" type="button" onClick={onRead}>
          <span className="tile-face">{pageMark || <PageMark />}<i className={pageConnected ? "dot on" : "dot"} /></span>
          <span className="tile-label">{pageConnected ? "Page" : "Connect"}</span>
        </button>
      </div>
    </div>
  );
}

function PageMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M3.2 2.2h6.4L12.8 5.4v8.4H3.2V2.2Zm5.8 1.2v2.6h2.6V12.6H4.4V3.4h4.6Z" />
    </svg>
  );
}
