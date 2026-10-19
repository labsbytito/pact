import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";

export function EmptyState({
  appearance,
  caption,
  site,
  chips,
  onRead,
  onAsk,
}: {
  appearance?: CompanionAppearance;
  caption?: string;
  site: string;
  chips: string[];
  onRead: () => void;
  onAsk: (text: string) => void;
}) {
  return (
    <div className="empty">
      <PactBlob state="idle" size={72} live appearance={appearance} label="Pact" />
      <p className="step-caption">{caption}</p>
      <h2>A little intention.</h2>
      <p className="site-line">{site}</p>
      <div className="ask-row">
        {chips.map((chip) => (
          <button key={chip} className="ask-chip" type="button" onClick={() => onAsk(chip)}>{chip}</button>
        ))}
      </div>
      <button className="primary-btn" type="button" onClick={onRead}>Read this page</button>
    </div>
  );
}
