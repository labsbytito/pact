import type { CompanionAppearance } from "../../lib/character";
import type { Action } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";

export function activityLine(action: Action) {
  if (action.status === "failed") return "Couldn't ask Fo";
  if (/visiting information/i.test(action.title)) return "Asked Fo for visiting hours";
  const topic = action.title.replace(/^ask fo\s+(for|to)\s+/i, "").trim();
  if (!topic || topic.length > 42 || topic === action.instruction) return "Asked Fo";
  return `Asked Fo for ${topic.charAt(0).toLowerCase()}${topic.slice(1)}`;
}

export function Activity({ action, appearance }: { action: Action; appearance?: CompanionAppearance }) {
  return (
    <div className="activity">
      <span className="activity-ico"><PactBlob size={14} state="still" appearance={appearance} /></span>
      <span>{activityLine(action)}</span>
    </div>
  );
}
