import type { Action } from "../../lib/model";
import { ApproveButton } from "./ApproveButton";

export function ProposedRequest({
  action,
  busy,
  signedOut,
  onApprove,
  onCancel,
  onConnect,
}: {
  action: Action;
  busy: boolean;
  signedOut?: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onConnect?: () => void;
}) {
  const message = typeof action.arguments?.message === "string" ? action.arguments.message : action.instruction;
  return (
    <section className="card request" aria-label={`Request to Fo. ${action.toolName || "ask_fo"}`}>
      <h3>Request to Fo</h3>
      <pre className="mono" title={action.toolName || "ask_fo"}>{message}</pre>
      {signedOut && onConnect && (
        <button className="primary-btn" type="button" onClick={onConnect}>Connect Fo</button>
      )}
      <div className="row-actions">
        <ApproveButton disabled={busy || action.status !== "proposed"} onClick={onApprove} />
        <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </section>
  );
}
