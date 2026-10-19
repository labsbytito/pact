import { useState } from "react";
import type { Action } from "../../lib/model";
import { ApproveButton } from "./ApproveButton";

export function ProposedRequest({
  action,
  busy,
  onApprove,
  onCancel,
}: {
  action: Action;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const message = typeof action.arguments?.message === "string" ? action.arguments.message : action.instruction;
  const sentence = message.length > 180 ? `${message.slice(0, 160).replace(/\s+\S*$/, "")}…` : message;
  return (
    <section className="card" aria-label="Request to Fo">
      <p style={{ margin: 0 }}>{sentence}</p>
      <button className="ghost-btn" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? "Hide details" : "View details"}
      </button>
      {open && (
        <div className="details">
          <div>{action.toolName || "ask_fo"}</div>
          <pre className="mono">{message}</pre>
        </div>
      )}
      <div className="row-actions">
        <ApproveButton disabled={busy || action.status !== "proposed"} onClick={onApprove} />
        <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>Deny</button>
      </div>
    </section>
  );
}
