import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { BlobState } from "../../lib/pact-blob";

export function PactHeader({
  title,
  caption,
  live,
  state,
  appearance,
  demo,
  onBack,
  onSettings,
  glass,
}: {
  title: string;
  caption: string;
  live?: boolean;
  state: BlobState;
  appearance?: CompanionAppearance;
  demo?: boolean;
  onBack?: () => void;
  onSettings: () => void;
  glass?: boolean;
}) {
  return (
    <header className={glass ? "topbar glass" : "topbar"}>
      {onBack && <button className="icon-btn" type="button" aria-label="Back" onClick={onBack}>←</button>}
      <div className="brand">
        <PactBlob state={state} size={24} live={live} appearance={appearance} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>{title}</h1>
          <p className="step-caption">{caption}</p>
        </div>
      </div>
      {demo && <span className="demo-tag">Demo mode</span>}
      <button className="icon-btn" type="button" aria-label="Settings" onClick={onSettings}>⚙</button>
    </header>
  );
}
