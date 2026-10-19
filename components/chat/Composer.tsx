import { ArrowUp, Mic, Plus, Square, X, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ATTACHMENT_LIMITS, prepareAttachment, type Attachment } from "../../lib/attachments";
import "./attachments.css";

export function Composer({
  value,
  attachments = [],
  onAttachments,
  onChange,
  onSend,
  onStop,
  streaming,
  onRead,
  onDictate,
  sendWithEnter = true,
}: {
  value: string;
  attachments?: Attachment[];
  onAttachments?: (files: Attachment[]) => void;
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
  const picker = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  async function attach(files: File[]) {
    if (files.length + attachments.length > ATTACHMENT_LIMITS.maxFiles) { setError("Attach up to 3 files at a time."); return; }
    setPreparing(true); setError("");
    try {
      const prepared = await Promise.all(files.map(prepareAttachment));
      onAttachments?.([...attachments, ...prepared]);
    } catch (e) { setError(e instanceof Error ? e.message : "That file could not be read."); }
    finally { setPreparing(false); }
  }
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
      <input ref={picker} type="file" multiple accept={ATTACHMENT_LIMITS.accept} hidden onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void attach(files); }} />
      {attachments.length > 0 && <div className="attachment-list">{attachments.map((file) => <span className="attachment-chip" key={file.id}><Paperclip size={13} aria-hidden="true" /><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} disabled={preparing || streaming} onClick={() => onAttachments?.(attachments.filter((item) => item.id !== file.id))}><X size={13} /></button></span>)}</div>}
      {preparing && <p className="conn-note" role="status">Reading files…</p>}
      {error && <p className="conn-note" role="alert">{error}</p>}
      {!!attachments.length && <p className="attachment-privacy">Files go to Claude with this chat. Saved on this device; deleting the chat removes its file contents.</p>}

      {menu && (
        <div className="menu glass" role="menu">
          <button type="button" role="menuitem" disabled={preparing || streaming} onClick={() => { setMenu(false); picker.current?.click(); }}>Attach file</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(false); onRead(); }}>Read this page</button>
        </div>
      )}
      <form
        className="composer glass"
        onSubmit={(event) => {
          event.preventDefault();
          if (!streaming && !preparing) onSend();
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
            if (event.key !== "Enter" || event.shiftKey || streaming || preparing || event.nativeEvent.isComposing) return;
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
          <button className="send" type="submit" aria-label="Send" disabled={preparing || (!value.trim() && !attachments.length)}>
            <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
}

