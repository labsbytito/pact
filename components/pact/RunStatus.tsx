import type { Action } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";

const copy: Record<string, string> = {
  approved: "Asking Fo…",
  running: "Asking Fo…",
  needs_answer: "Fo has a question",
  failed: "Fo could not finish",
  unknown: "Check Fo before trying again",
};

export function RunStatus({ action, appearance }: { action: Action; appearance?: CompanionAppearance }) {
  const progress = action.progress?.trim() ?? "";
  const text = progress && !/working/i.test(progress) ? progress : copy[action.status] || "Asking Fo…";
  if (action.status === "proposed" || action.status === "returned" || action.status === "superseded") return null;
  return (
    <div className="status-line">
      <PactBlob state={action.status === "failed" || action.status === "unknown" ? "error" : "thinking"} size={24} appearance={appearance} />
      <span>{text}</span>
    </div>
  );
}
