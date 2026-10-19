import type { Action } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";

const copy: Record<string, string> = {
  approved: "Queued. Pact is about to ask Fo.",
  running: "Asking Fo…",
  needs_answer: "Fo has a question",
  failed: "Fo could not finish. Nothing was changed that Fo didn't report.",
  unknown: "Not sure Fo got this. Check Fo before sending again.",
};
const steps = ["Queued", "Asking Fo", "Waiting for Fo", "Returned"];

function stepIndex(action: Action, progress: string) {
  if (action.status === "approved") return 0;
  if (action.status === "running") return progress && !/^working/i.test(progress) ? 2 : 1;
  if (action.status === "needs_answer") return 2;
  return -1;
}

export function RunStatus({ action, appearance, onRetry }: { action: Action; appearance?: CompanionAppearance; onRetry?: () => void }) {
  const progress = action.progress?.trim() ?? "";
  const text = progress && !/working/i.test(progress) ? progress : copy[action.status] || "Asking Fo…";
  if (action.status === "proposed" || action.status === "returned" || action.status === "superseded") return null;
  const bad = action.status === "failed" || action.status === "unknown";
  const retryable = action.status === "failed";
  const at = stepIndex(action, progress);
  return (
    <div className="card" role="status">
      <div className="status-line">
        <PactBlob state={bad ? "error" : "thinking"} size={24} appearance={appearance} />
        <span>{text}</span>
      </div>
      {at >= 0 && (
        <ol className="run-steps" aria-label="Progress">
          {steps.map((label, index) => <li key={label} data-state={index < at ? "done" : index === at ? "now" : "next"}>{label}</li>)}
        </ol>
      )}
      {action.status === "needs_answer" && action.result && <p className="meta">{action.result}</p>}
      {action.status === "needs_answer" && <p className="meta">Reply below and Fo will continue this conversation.</p>}
      {retryable && onRetry && <div className="row-actions"><button className="primary-btn" type="button" onClick={onRetry}>Retry</button></div>}
    </div>
  );
}
