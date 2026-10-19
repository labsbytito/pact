import { Fragment } from "react";
import type { CompanionAppearance } from "../../lib/character";
import type { Pact } from "../../lib/model";
import { Activity } from "../pact/Journal";
import { ProposedRequest } from "../pact/ProposedRequest";
import { ResultCard } from "../pact/ResultCard";
import { Message } from "./Message";
import { Thread } from "./Thread";
import { Typing } from "./Typing";

const settled = new Set(["returned", "failed", "superseded"]);

export function Transcript({
  active,
  busy,
  streaming,
  signedOut,
  appearance,
  onConnect,
  onApprove,
  onCancel,
  onRetry,
  onEdit,
}: {
  active: Pact;
  busy: boolean;
  streaming?: boolean;
  signedOut: boolean;
  appearance?: CompanionAppearance;
  onConnect: () => void;
  onApprove: (pact: Pact) => void;
  onCancel: (pact: Pact) => void;
  onRetry: (text: string) => void;
  onEdit: (text: string) => void;
}) {
  const action = active.action;
  const runs = (active.actions ?? []).filter((item) => item.status === "returned" && item.result);
  const tagged = runs.filter((item) => item.messageId);
  const loose = runs.filter((item) => !item.messageId);
  let shown = 0;
  const last = active.messages.at(-1);
  const waiting = Boolean(streaming && last?.role === "assistant" && !last.text);
  const showCard = action?.status === "proposed" && (!action.explicit || signedOut);
  const failed = action?.status === "failed";
  const prior = [...active.messages].reverse().find((entry) => entry.role === "user")?.text;
  return (
    <Thread>
      {active.messages.map((item, index) => {
        const next = active.messages[index + 1];
        const previous = active.messages[index - 1];
        const taggedHit = item.role === "assistant" ? tagged.find((run) => run.messageId === item.id) : undefined;
        const looseHit = !taggedHit && item.role === "assistant" && (!next || next.role === "user") ? loose[shown] : undefined;
        if (looseHit) shown += 1;
        const result = taggedHit ?? looseHit;
        return (
          <Fragment key={item.id}>
            {item.text && (
              <Message
                role={item.role}
                text={item.text}
                follow={previous?.role === item.role}
                appearance={appearance}
                onRetry={item.role === "assistant" && prior ? () => onRetry(prior) : undefined}
                onEdit={item.role === "user" ? onEdit : undefined}
              />
            )}
            {result?.result && <ResultCard text={result.result} />}
          </Fragment>
        );
      })}
      {waiting && <Typing />}
      {action?.status === "needs_answer" && action.result && <p className="meta">{action.result}</p>}
      {action?.status === "needs_answer" && <p className="meta">Reply below and Fo will continue this conversation.</p>}
      {showCard && action && (
        <ProposedRequest action={action} busy={busy} signedOut={signedOut} onApprove={() => onApprove(active)} onCancel={() => onCancel(active)} onConnect={onConnect} />
      )}
      {failed && action && (
        <section className="card request" aria-label="Fo couldn't finish that">
          <h3>Fo couldn't finish that</h3>
          <p className="request-copy">{action.result || "Something went wrong before Fo could answer."}</p>
          <div className="row-actions">
            {signedOut ? (
              <button className="primary-btn" type="button" onClick={onConnect}>Connect Fo</button>
            ) : (
              <button className="primary-btn" type="button" onClick={() => onApprove(active)} disabled={busy}>Retry</button>
            )}
          </div>
        </section>
      )}
      {(active.actions ?? []).filter((item) => settled.has(item.status) && !(failed && item.id === action?.id)).map((item) => (
        <Activity key={item.id} action={item} appearance={appearance} />
      ))}
    </Thread>
  );
}
