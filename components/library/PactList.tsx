import type { Pact } from "../../lib/model";

export function PactList({ pacts, onOpen }: { pacts: Pact[]; onOpen: (id: string) => void }) {
  if (!pacts.length) return <p className="section-label">No Pacts yet.</p>;
  return (
    <div>
      <div className="section-label">Pacts</div>
      {pacts.map((pact) => (
        <button key={pact.id} className="list-row" type="button" onClick={() => onOpen(pact.id)}>
          <span className="name">{pact.title}</span>
        </button>
      ))}
    </div>
  );
}
