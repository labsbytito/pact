import type { Source } from "../../lib/model";

export function SourceChip({ source, onClear }: { source: Source; onClear?: () => void }) {
  let host = source.url;
  try { host = new URL(source.url).hostname.replace(/^www\./, ""); } catch { /* keep url */ }
  return (
    <div className="chips">
      <span className="chip" title={source.title}>
        <span>{source.title || host}</span>
        {onClear && <button type="button" className="icon-btn" aria-label="Remove page" onClick={onClear}>×</button>}
      </span>
    </div>
  );
}
