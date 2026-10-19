import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";

export function ServerState({
  kind,
  model,
  dev,
  appearance,
  onRetry,
  onConnect,
}: {
  kind: "offline" | "limited" | "unconfigured" | "fo";
  model?: string;
  dev?: boolean;
  appearance?: CompanionAppearance;
  onRetry: () => void;
  onConnect?: () => void;
}) {
  const copy = {
    offline: ["Can’t reach Pact", "Your Pacts are still saved on this computer."],
    limited: ["Pact needs a short break", "Try again in a little while."],
    unconfigured: ["Pact isn’t configured", model ? `The model ${model} isn’t ready.` : "Add a Claude key on the companion."],
    fo: ["Connect Fo", "Fo runs the request after you approve it."],
  }[kind];
  return (
    <div className="server">
      <PactBlob state={kind === "offline" ? "sleepy" : kind === "fo" ? "idle" : "error"} size={72} appearance={appearance} />
      <h2>{copy[0]}</h2>
      <p>{copy[1]}</p>
      {kind === "offline" && dev && <code>pnpm --filter backend dev</code>}
      {kind === "fo" && onConnect ? (
        <button className="primary-btn" type="button" onClick={onConnect}>Connect Fo</button>
      ) : (
        <button className="text-btn" type="button" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
