import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import type { Pact } from "../../lib/model";

const tags: Record<string, string> = {
  proposed: "Waiting",
  approved: "Asking",
  running: "Asking",
  returned: "Returned",
  needs_answer: "Question",
  failed: "Failed",
};

export function PactList({
  pacts,
  activeId,
  appearance,
  onOpen,
}: {
  pacts: Pact[];
  activeId?: string | null;
  appearance?: CompanionAppearance;
  onOpen: (id: string) => void;
}) {
  if (!pacts.length) return <p className="section-label">No Pacts yet.</p>;
  return (
    <div>
      {pacts.map((pact) => {
        const preview = [...pact.messages].reverse().find((item) => item.text.trim())?.text ?? pact.intention;
        const tag = pact.action ? tags[pact.action.status] : "";
        return (
          <button key={pact.id} className="list-row" type="button" aria-current={pact.id === activeId ? "true" : undefined} onClick={() => onOpen(pact.id)}>
            <PactBlob size={20} state="still" appearance={appearance} />
            <span className="list-copy">
              <span className="list-title">
                <span className="name">{pact.title}</span>
                {tag && <span className="list-tag">{tag}</span>}
              </span>
              <span className="list-preview">{preview}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
