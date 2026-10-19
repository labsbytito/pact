import { useEffect, useRef, useState } from "react";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  onRead,
  onDictate,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  onRead: () => void;
  onDictate: () => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 126)}px`;
  }, [value]);
  return (
    <div className="composer-wrap">
      {menu && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setMenu(false); onRead(); }}>Read this page</button>
        </div>
      )}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!streaming) onSend();
        }}
      >
        <button className="icon-btn" type="button" aria-label="Add page or file" onClick={() => setMenu((open) => !open)}>+</button>
        <textarea
          ref={box}
          rows={1}
          value={value}
          placeholder="Message Pact"
          aria-label="Message Pact"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!streaming) onSend();
            }
          }}
        />
        <button className="icon-btn" type="button" aria-label="Dictate" onClick={onDictate}>
          <MicIcon />
        </button>
        {streaming ? (
          <button className="send stop" type="button" aria-label="Stop" onClick={onStop}>
            <span style={{ width: 8, height: 8, background: "currentColor", display: "block" }} />
          </button>
        ) : (
          <button className="send" type="submit" aria-label="Send" disabled={!value.trim()}>
            <ArrowIcon />
          </button>
        )}
      </form>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V4A2.5 2.5 0 0 0 8 1.5Z" />
      <path fill="currentColor" d="M4 7.2a.6.6 0 0 0-1.2 0A5.2 5.2 0 0 0 7.4 12.3V14H6a.6.6 0 0 0 0 1.2h4a.6.6 0 0 0 0-1.2H8.6v-1.7A5.2 5.2 0 0 0 13.2 7.2a.6.6 0 0 0-1.2 0 4 4 0 0 1-8 0Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path fill="currentColor" d="M6 1.4 10.2 6.1 9.3 7 6.7 4.2v6.4H5.3V4.2L2.7 7 1.8 6.1 6 1.4Z" />
    </svg>
  );
}
