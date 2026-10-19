import { PactBlob } from "../companion/PactBlob";
import { ArrowLeftIcon, ListIcon, SettingsIcon } from "../icons";
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
  onSettings: () => void;
}) {
  return (
    <header className="float-bar">
      {onBack ? (
        <button className="float-btn" type="button" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
      ) : (
        <span />
      )}
      <div className="name-pill glass">
        <PactBlob state={state} size={24} live={live} appearance={appearance} />
        <h1>{title}</h1>
      </div>
      <div className="float-actions">
        {onList && (
          <button className="float-btn" type="button" aria-label="Pacts" onClick={onList}>
            <ListIcon />
          </button>
        )}
        <button className="float-btn" type="button" aria-label="Settings" onClick={onSettings}>
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
