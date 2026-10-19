import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { BlobState } from "../../lib/pact-blob";

export function LivePill({
  text,
  state,
  appearance,
  demo,
  working,
}: {
  text: string;
  state: BlobState;
  appearance?: CompanionAppearance;
  demo?: boolean;
  working?: boolean;
}) {
  return (
    <div className="live-pill glass" role="status">
      <PactBlob size={16} state={state} appearance={appearance} live />
      <span className="live-step">{text}</span>
      <i className="live-dot" data-on={working ? "work" : "idle"} />
      {import.meta.env.DEV && demo && <em className="live-demo">Demo</em>}
    </div>
  );
}
