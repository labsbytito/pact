import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  onRead,
  onDictate,
  sendWithEnter = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  onRead: () => void;
  onDictate: () => void;
  sendWithEnter?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 126);
    el.style.height = `${next}px`;
    el.form?.toggleAttribute("data-multiline", next > 56);
  }, [value]);
  return (
    <div className="composer-wrap">
      {menu && (
        <div className="menu glass" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenu(false); onRead(); }}>Read this page</button>
        </div>
      )}
      <form
        className="composer glass"
        onSubmit={(event) => {
          event.preventDefault();
          if (!streaming) onSend();
        }}
      >
        <button className="icon-btn composer-tool plus" type="button" aria-label="Add page or file" onClick={() => setMenu((open) => !open)}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <textarea
          ref={box}
          rows={1}
          value={value}
          placeholder="Message Pact"
          aria-label="Message Pact"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const command = event.metaKey || event.ctrlKey;
            if (event.key !== "Enter" || event.shiftKey || streaming) return;
            if (sendWithEnter && !command) {
              event.preventDefault();
              onSend();
            } else if (!sendWithEnter && command) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button className="icon-btn composer-tool mic" type="button" aria-label="Dictate" onClick={onDictate}>
          <Mic size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        {streaming ? (
          <button className="send stop" type="button" aria-label="Stop" onClick={onStop}>
            <Square size={10} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          </button>
        ) : (
          <button className="send" type="submit" aria-label="Send" disabled={!value.trim()}>
            <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
}

