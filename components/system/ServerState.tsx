import { useEffect } from "react";
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
    offline: ["Can’t reach Pact", "Check your connection. Your chats are saved on this computer, and Pact will retry on its own."],
    limited: ["Pact is busy right now", "Today’s free AI budget may be used up, or a lot of people are trying it. Your chats are safe, and Pact will retry on its own."],
    unconfigured: ["Pact isn’t ready yet", dev && model ? `The model ${model} isn’t ready.` : "The Pact service is being set up. Try again soon."],
    fo: ["Connect Fo", "Fo runs the request after you approve it."],
  }[kind];
  useEffect(() => {
    if (kind !== "offline" && kind !== "limited") return;
    const timer = window.setInterval(onRetry, 20000);
    return () => window.clearInterval(timer);
  }, [kind, onRetry]);
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
