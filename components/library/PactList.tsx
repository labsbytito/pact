import { Archive, ArchiveRestore, Download, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export function pactToMarkdown(pact: Pact) {
  const lines = [`# ${pact.title}`, ""];
  for (const item of pact.messages) {
    if (!item.text.trim()) continue;
    lines.push(`**${item.role === "user" ? "You" : "Pact"}**`, "", item.text.trim(), "");
  }
  return lines.join("\n");
}

function download(pact: Pact) {
  const url = URL.createObjectURL(new Blob([pactToMarkdown(pact)], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${pact.title.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "pact"}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Command = "rename" | "pin" | "archive" | "delete";

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
  onChange?: (id: string, command: Command, name?: string) => void;
  onNew?: () => void;
}) {
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const settled = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuId) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.("[data-pact-menu]")) setMenuId(null);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setMenuId(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
  }, [menuId]);
  const needle = query.trim().toLowerCase();
  const matches = (pact: Pact) => !needle || pact.title.toLowerCase().includes(needle) || pact.messages.some((m) => m.text.toLowerCase().includes(needle));
  const shown = sortLibraryPacts(pacts.filter((p) => !p.deletedAt && !!p.archived === archived && matches(p)));
  const pinned = shown.filter((p) => p.pinned);
  const rest = shown.filter((p) => !p.pinned);
  const archivedCount = pacts.filter((p) => !p.deletedAt && p.archived).length;

  function commitRename(pact: Pact) {
    if (settled.current) return;
    settled.current = true;
    const name = draft.trim();
    setRenaming(null);
    if (name && name !== pact.title) onChange?.(pact.id, "rename", name);
  }

  function row(pact: Pact) {
    const preview = [...pact.messages].reverse().find((item) => item.text.trim())?.text ?? pact.intention;
    const tag = pact.action ? tags[pact.action.status] : "";
    const menu = menuId === pact.id;
    return (
      <div className="library-item" key={pact.id} data-active={pact.id === activeId ? "true" : undefined} data-menu={menu ? "open" : undefined}>
        {confirming === pact.id ? (
          <div className="library-confirm" role="alertdialog" aria-label="Delete this Pact">
            <p>Delete “{pact.title}”? Its messages and file contents are removed. Records of Fo requests already sent are kept.</p>
            <div>
              <button type="button" onClick={() => setConfirming(null)}>Cancel</button>
              <button type="button" className="danger" autoFocus onClick={() => { setConfirming(null); onChange?.(pact.id, "delete"); }}>Delete</button>
            </div>
          </div>
        ) : renaming === pact.id ? (
          <form className="library-rename" onSubmit={(event) => { event.preventDefault(); commitRename(pact); }}>
            <PactBlob size={20} state="still" appearance={pact.companion?.appearance ?? appearance} />
            <input autoFocus value={draft} maxLength={60} aria-label="Pact name" onChange={(event) => setDraft(event.target.value)} onBlur={() => commitRename(pact)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); settled.current = true; setRenaming(null); } }} />
          </form>
        ) : (
          <>
            <button className="list-row" type="button" aria-current={pact.id === activeId ? "true" : undefined} onClick={() => onOpen(pact.id)}>
              <PactBlob size={20} state="still" appearance={pact.companion?.appearance ?? appearance} />
              <span className="list-copy">
                <span className="list-title">
                  {pact.pinned && <Pin size={11} aria-label="Pinned" className="list-pin" />}
                  <span className="name">{pact.title}</span>
                  {tag && <span className="list-tag">{tag}</span>}
                </span>
                <span className="list-preview">{preview}</span>
              </span>
            </button>
            <div className="library-more" data-pact-menu>
              <button type="button" className="icon-btn" aria-label={`Options for ${pact.title}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenuId(menu ? null : pact.id)}>
                <MoreHorizontal size={16} strokeWidth={1.75} />
              </button>
              {menu && (
                <div className="library-menu glass" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuId(null); setDraft(pact.title); settled.current = false; setRenaming(pact.id); }}><Pencil size={14} />Rename</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuId(null); onChange?.(pact.id, "pin"); }}>{pact.pinned ? <PinOff size={14} /> : <Pin size={14} />}{pact.pinned ? "Unpin" : "Pin"}</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuId(null); download(pact); }}><Download size={14} />Export as Markdown</button>
                  <button type="button" role="menuitem" onClick={() => { setMenuId(null); onChange?.(pact.id, "archive"); }}>{pact.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}{pact.archived ? "Restore" : "Archive"}</button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setMenuId(null); setConfirming(pact.id); }}><Trash2 size={14} />Delete</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="library" ref={root}>
      <div className="library-tools">
        <label className="library-search">
          <Search size={14} aria-hidden="true" />
          <input type="search" value={query} placeholder="Search Pacts" aria-label="Search Pacts" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="library-new" onClick={onNew}><Plus size={14} aria-hidden="true" />New</button>
      </div>
      <div className="library-tabs" role="tablist" aria-label="Pact lists">
        <button type="button" role="tab" aria-selected={!archived} onClick={() => setArchived(false)}>Active</button>
        <button type="button" role="tab" aria-selected={archived} onClick={() => setArchived(true)}>Archived{archivedCount ? ` · ${archivedCount}` : ""}</button>
      </div>
      {!shown.length && <p className="section-label">{needle ? "No Pacts match that search." : archived ? "Nothing archived." : "No Pacts yet. Start one with New."}</p>}
      {pinned.length > 0 && <p className="section-label">Pinned</p>}
      {pinned.map(row)}
      {pinned.length > 0 && rest.length > 0 && <p className="section-label">Recent</p>}
      {rest.map(row)}
    </div>
  );
}
