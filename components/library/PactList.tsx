import { useState } from "react";
import { sortLibraryPacts } from "../../lib/library";
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
  onChange,
  onNew,
}: {
  pacts: Pact[];
  activeId?: string | null;
  appearance?: CompanionAppearance;
  onOpen: (id: string) => void;
  onChange?: (id: string, command: "rename" | "pin" | "archive" | "delete", name?: string) => void;
  onNew?: () => void;
}) {
  const [archived, setArchived] = useState(false);
  const shown = sortLibraryPacts(pacts.filter((p) => !p.deletedAt && !!p.archived === archived));
  return (
    <div>
      <div className="library-tools"><button type="button" onClick={onNew}>New Pact</button><button type="button" aria-pressed={archived} onClick={() => setArchived(!archived)}>{archived ? "Show active" : "Show archived"}</button></div>
      {!shown.length && <p className="section-label">{archived ? "No archived Pacts." : "No Pacts yet."}</p>}
      {shown.map((pact) => {
        const preview = [...pact.messages].reverse().find((item) => item.text.trim())?.text ?? pact.intention;
        const tag = pact.action ? tags[pact.action.status] : "";
        return (
          <div className="library-item" key={pact.id}><button className="list-row" type="button" aria-current={pact.id === activeId ? "true" : undefined} onClick={() => onOpen(pact.id)}>
            <PactBlob size={20} state="still" appearance={pact.companion?.appearance ?? appearance} />
            <span className="list-copy">
              <span className="list-title">
                <span className="name">{pact.title}</span>
                {tag && <span className="list-tag">{tag}</span>}
              </span>
              <span className="list-preview">{preview}</span>
            </span>
          </button>
          <div className="library-controls">
          <button type="button" onClick={() => { const name = window.prompt("Rename Pact", pact.title); if (name?.trim()) onChange?.(pact.id, "rename", name); }}>Rename</button>
          <button type="button" onClick={() => onChange?.(pact.id, "pin")}>{pact.pinned ? "Unpin" : "Pin"}</button>
          <button type="button" onClick={() => onChange?.(pact.id, "archive")}>{pact.archived ? "Restore" : "Archive"}</button>
          <button type="button" onClick={() => { if (window.confirm("Delete this Pact and its file contents? Existing Fo actions cannot be undone; their records will be retained.")) onChange?.(pact.id, "delete"); }}>Delete</button>
          </div></div>
        );
      })}
    </div>
  );
}
