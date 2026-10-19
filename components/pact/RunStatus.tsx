import type { Action } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";

const copy: Record<string, string> = {
  approved: "Asking Fo…",
  running: "Asking Fo…",
  needs_answer: "Fo has a question",
  failed: "Fo could not finish",
  unknown: "Not sure Fo got this. Check Fo before sending again.",
};

export function RunStatus({ action, appearance }: { action: Action; appearance?: CompanionAppearance }) {
  const progress = action.progress?.trim() ?? "";
  const text = progress && !/working/i.test(progress) ? progress : copy[action.status] || "Asking Fo…";
  if (action.status === "proposed" || action.status === "returned" || action.status === "superseded") return null;
  return (
    <div className="card">
      <div className="status-line">
        <PactBlob state={action.status === "failed" || action.status === "unknown" ? "error" : "thinking"} size={24} appearance={appearance} />
        <span>{text}</span>
      </div>
      {action.status === "needs_answer" && action.result && <p className="meta">{action.result}</p>}
      {action.status === "needs_answer" && <p className="meta">Reply below and Fo will continue this conversation.</p>}
    </div>
  );
}
