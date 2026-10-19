import { useState } from "react";
import { Markdown } from "./Markdown";

export function Message({
  role,
  text,
  at,
  stopped,
  onRetry,
}: {
  role: "user" | "assistant";
  text: string;
  at?: string;
  stopped?: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const time = at ? new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return (
    <div className={`bubble ${role}`} tabIndex={0}>
      {role === "assistant" ? <Markdown text={text} /> : text}
      <div className="bubble-meta">
        {time && <span>{time}</span>}
        <button
          type="button"
          className={copied ? "tick" : undefined}
          onClick={() => {
            void navigator.clipboard?.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {stopped && onRetry && <button type="button" onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
}
