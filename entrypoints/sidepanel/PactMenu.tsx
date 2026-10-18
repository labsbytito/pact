import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Pin,
  Pencil,
  FolderInput,
  Archive,
  Trash2,
  ChevronRight,
} from "lucide-react";
import type { Pact, PactSection } from "../../lib/model";

const ICON = 1.5;

export type PactMenuAction =
  | { type: "pin" }
  | { type: "rename" }
  | { type: "archive" }
  | { type: "delete" }
  | { type: "move"; sectionId: string | null }
  | { type: "new-section" };

type ActionItem = {
  kind: "action";
  id: string;
  label: string;
  run: () => void;
  danger?: boolean;
  trailing?: ReactNode;
  leading?: ReactNode;
};
type SepItem = { kind: "sep"; id: string };
type Item = ActionItem | SepItem;

export default function PactMenu({
  pact,
  sections,
  style,
  className,
  onAction,
  onClose,
}: {
  pact: Pact;
  sections: readonly PactSection[];
  style?: CSSProperties;
  className?: string;
  onAction: (action: PactMenuAction) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [focus, setFocus] = useState(0);

  const main: Item[] = [
    {
      kind: "action",
      id: "pin",
      label: pact.pinned ? "Unpin" : "Pin",
      leading: <Pin size={14} strokeWidth={ICON} />,
      run: () => onAction({ type: "pin" }),
    },
    {
      kind: "action",
      id: "rename",
      label: "Rename…",
      leading: <Pencil size={14} strokeWidth={ICON} />,
      run: () => onAction({ type: "rename" }),
    },
    {
      kind: "action",
      id: "move",
      label: "Move to section",
      leading: <FolderInput size={14} strokeWidth={ICON} />,
      trailing: <ChevronRight size={14} strokeWidth={ICON} />,
      run: () => setMoveOpen(true),
    },
    {
      kind: "action",
      id: "archive",
      label: pact.archived ? "Unarchive" : "Archive",
      leading: <Archive size={14} strokeWidth={ICON} />,
      run: () => onAction({ type: "archive" }),
    },
    { kind: "sep", id: "sep" },
    {
      kind: "action",
      id: "delete",
      label: "Delete",
      danger: true,
      leading: <Trash2 size={14} strokeWidth={ICON} />,
      run: () => onAction({ type: "delete" }),
    },
  ];

  const move: Item[] = [
    {
      kind: "action",
      id: "none",
      label: "None",
      run: () => onAction({ type: "move", sectionId: null }),
    },
    ...sections.map(
      (section): ActionItem => ({
        kind: "action",
        id: section.id,
        label: section.name,
        run: () => onAction({ type: "move", sectionId: section.id }),
      }),
    ),
    {
      kind: "action",
      id: "new",
      label: "New section…",
      run: () => onAction({ type: "new-section" }),
    },
  ];

  const active = moveOpen ? move : main;
  const actionIndexes = active
    .map((item, index) => (item.kind === "action" ? index : -1))
    .filter((i) => i >= 0);

  useEffect(() => {
    setFocus(actionIndexes[0] ?? 0);
    requestAnimationFrame(() => {
      root.current
        ?.querySelectorAll<HTMLElement>("[role=menuitem]")[0]
        ?.focus();
    });
  }, [moveOpen]);

  function focusIndex(next: number) {
    setFocus(next);
    const pos = actionIndexes.indexOf(next);
    root.current
      ?.querySelectorAll<HTMLElement>("[role=menuitem]")
      [pos]?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (moveOpen) setMoveOpen(false);
      else onClose();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const at = actionIndexes.indexOf(focus);
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const next =
        actionIndexes[(at + dir + actionIndexes.length) % actionIndexes.length]!;
      focusIndex(next);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      const item = active[focus];
      if (item?.kind !== "action") return;
      e.preventDefault();
      item.run();
      if (item.id !== "move") onClose();
    }
  }

  return (
    <div
      ref={root}
      className={`pact-menu${className ? ` ${className}` : ""}`}
      role="menu"
      style={style}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
    >
      {moveOpen && (
        <button
          type="button"
          className="menu-back"
          onClick={() => setMoveOpen(false)}
        >
          ← Back
        </button>
      )}
      {active.map((item, index) =>
        item.kind === "sep" ? (
          <div key={item.id} className="menu-sep" role="separator" />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            tabIndex={focus === index ? 0 : -1}
            className={`menu-item${item.danger ? " danger" : ""}`}
            onMouseEnter={() => setFocus(index)}
            onClick={() => {
              item.run();
              if (item.id !== "move") onClose();
            }}
          >
            {item.leading}
            <span>{item.label}</span>
            {item.trailing}
          </button>
        ),
      )}
    </div>
  );
}
