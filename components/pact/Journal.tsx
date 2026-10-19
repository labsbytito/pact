import type { CompanionAppearance } from "../../lib/character";
import type { Action } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";

export function Activity({ action, appearance }: { action: Action; appearance?: CompanionAppearance }) {
  const lead = action.status === "failed" ? "Couldn't ask Fo" : "Asked Fo";
  return (
    <div className="activity">
      <span className="activity-ico"><PactBlob size={16} state="still" appearance={appearance} /></span>
      <span>{lead} · {action.title}</span>
    </div>
  );
}
