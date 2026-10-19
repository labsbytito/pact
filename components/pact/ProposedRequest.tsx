import type { Action } from "../../lib/model";
import { visibleRequest } from "../../lib/request-text";
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
  const raw = typeof action.arguments?.message === "string" ? action.arguments.message : action.instruction;
  const message = visibleRequest(raw);
  return (
    <section className="card request" aria-label="Request to Fo">
      <h3>Request to Fo</h3>
      <p className="request-copy">{message}</p>
      {action.toolName !== "ask_fo" && <details><summary>Review exact {action.toolName} request</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(action.arguments, null, 2)}</pre></details>}
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
