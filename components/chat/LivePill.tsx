import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { BlobState } from "../../lib/pact-blob";

export function LivePill({
  text,
  state,
  appearance,
  demo,
}: {
  text: string;
  state: BlobState;
  appearance?: CompanionAppearance;
  demo?: boolean;
}) {
  return (
    <div className="live-pill glass" role="status">
      <PactBlob size={20} state={state} appearance={appearance} />
      <strong>Pact</strong>
      <span className="live-rule" />
      <span className="live-step">{text}</span>
      {demo && <em className="live-demo">Demo</em>}
    </div>
  );
}
