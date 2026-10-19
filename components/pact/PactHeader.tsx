import { ArrowLeft, History, Settings } from "lucide-react";
import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { BlobState } from "../../lib/pact-blob";

export function PactHeader({
  title,
  live,
  state,
  appearance,
  onBack,
  onList,
  onSettings,
}: {
  title: string;
  live?: boolean;
  state: BlobState;
  appearance?: CompanionAppearance;
  onBack?: () => void;
  onList?: () => void;
  onSettings?: () => void;
}) {
  return (
    <header className="float-bar">
      {onBack ? (
        <button className="float-btn" type="button" aria-label="Back" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : (
        <span />
      )}
      <div className="name-pill glass">
        <PactBlob state={state} size={20} live={live} appearance={appearance} />
        <h1>{title}</h1>
      </div>
      <div className="float-actions">
        {onList && (
          <button className="float-btn" type="button" aria-label="History" onClick={onList}>
            <History size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        {onSettings && (
          <button className="float-btn" type="button" aria-label="Settings" onClick={onSettings}>
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
