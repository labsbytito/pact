import { characterFor } from "../../lib/character";
import type { Pact } from "../../lib/model";
import { PactBlob } from "../companion/PactBlob";

export function PactList({ pacts, onOpen }: { pacts: Pact[]; onOpen: (id: string) => void }) {
  if (!pacts.length) return <p className="section-label">No Pacts yet.</p>;
  return (
    <div>
      <div className="section-label">Pacts</div>
      {pacts.map((pact) => (
        <button key={pact.id} className="list-row" type="button" onClick={() => onOpen(pact.id)}>
          <PactBlob size={28} seed={pact.characterSeed ?? pact.id} state="still" />
          <span style={{ minWidth: 0 }}>
            <div className="name">{pact.title}</div>
            <div className="preview">{pact.messages.at(-1)?.text || pact.intention}</div>
          </span>
          <span className="sr">{characterFor(pact.characterSeed).color}</span>
        </button>
      ))}
    </div>
  );
}
