import type { Action } from "../../lib/model";
import { visibleRequest } from "../../lib/request-text";
import { ApproveButton } from "./ApproveButton";
import { summarize, toolInfo } from "./toolInfo";

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
  const tool = toolInfo(action.toolName ?? "ask_fo");
  return (
    <section className="card request" aria-label="Request to Fo">
      <h3>Request to Fo</h3>
      <dl className="req-meta">
        <div><dt>Service</dt><dd>Fo</dd></div>
        <div><dt>Action</dt><dd>{tool.name}</dd></div>
        <div><dt>Summary</dt><dd>{summarize(message)}</dd></div>
      </dl>
      <details className="req-exact">
        <summary>{action.toolName && action.toolName !== "ask_fo" ? `Review exact ${action.toolName} request` : "Review exact request"}</summary>
        {action.toolName && action.toolName !== "ask_fo"
          ? <pre className="mono">{JSON.stringify(action.arguments, null, 2)}</pre>
          : <p className="request-copy">{message}</p>}
      </details>
      <p className="meta">Nothing happens until you approve.</p>
      {signedOut ? (
        <div className="row-actions">
          <p className="meta">Connect Fo first</p>
          {onConnect && <button className="primary-btn" type="button" onClick={onConnect}>Connect Fo</button>}
        </div>
      ) : (
        <div className="row-actions">
          <ApproveButton retry={action.status === "failed"} disabled={busy || (action.status !== "proposed" && action.status !== "failed")} onClick={onApprove} />
          <button className="ghost-btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      )}
    </section>
  );
}
