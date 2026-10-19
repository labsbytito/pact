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
    <section className="card request" aria-label="Request to Fo">
      <h3>Request to Fo</h3>
      <p className="request-copy">{message}</p>
      {signedOut ? (
        <div className="row-actions">
          <p className="meta">Connect Fo first</p>
          {onConnect && <button className="primary-btn" type="button" onClick={onConnect}>Connect Fo</button>}
        </div>
      ) : (
        <div className="row-actions">
          <ApproveButton disabled={busy || (action.status !== "proposed" && action.status !== "failed")} onClick={onApprove} />
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      )}
    </section>
  );
}
