import { Fragment } from "react";
import type { CompanionAppearance } from "../../lib/character";
import type { Pact } from "../../lib/model";
import { Activity } from "../pact/Journal";
import { ProposedRequest } from "../pact/ProposedRequest";
import { ResultCard } from "../pact/ResultCard";
import { Message } from "./Message";
import { Thread } from "./Thread";

const settled = new Set(["returned", "failed", "superseded"]);

export function Transcript({
  active,
  busy,
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
  let shown = 0;
  return (
    <>
      <Thread>
        {active.messages.map((item, index) => {
          const next = active.messages[index + 1];
          const result = item.role === "assistant" && (!next || next.role === "user") ? runs[shown] : undefined;
          if (result) shown += 1;
          const prior = [...active.messages.slice(0, index)].reverse().find((entry) => entry.role === "user")?.text;
          return (
            <Fragment key={item.id}>
              {item.text && (
                <Message
                  role={item.role}
                  text={item.text}
                  appearance={appearance}
                  avatar={item.role === "assistant" && active.messages[index - 1]?.role !== "assistant"}
                  onRetry={item.role === "assistant" && prior ? () => onRetry(prior) : undefined}
                  onEdit={item.role === "user" ? onEdit : undefined}
                />
              )}
              {result?.result && <ResultCard text={result.result} />}
            </Fragment>
          );
        })}
      </Thread>
      {action?.status === "needs_answer" && action.result && <p className="meta">{action.result}</p>}
      {action?.status === "needs_answer" && <p className="meta">Reply below and Fo will continue this conversation.</p>}
      {action?.status === "proposed" && (
        <ProposedRequest action={action} busy={busy} signedOut={signedOut} onApprove={() => onApprove(active)} onCancel={() => onCancel(active)} onConnect={onConnect} />
      )}
      {(active.actions ?? []).filter((item) => settled.has(item.status)).map((item) => (
        <Activity key={item.id} action={item} appearance={appearance} />
      ))}
    </>
  );
}
