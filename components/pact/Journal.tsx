import { useState } from "react";
import type { Action } from "../../lib/model";
import { ChevronIcon } from "../icons";

const labels: Record<string, string> = {
  proposed: "Proposed",
  approved: "Approved",
  running: "Asking Fo",
  returned: "Returned",
  needs_answer: "Question",
  failed: "Failed",
  unknown: "Unknown",
  superseded: "Cancelled",
};

export function Journal({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  return (
    <div className="journal">
      <button className="journal-row" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronIcon open={open} />
        <span>Runs ({actions.length})</span>
      </button>
      {open && actions.map((action) => (
        <div key={action.id} className="journal-row">
          <span className="journal-title">{action.title}</span>
          <span className="journal-status">{labels[action.status] ?? action.status}</span>
        </div>
      ))}
    </div>
  );
}
