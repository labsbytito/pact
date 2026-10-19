import type { CompanionAppearance } from "../../lib/character";
import { CopyIcon, PencilIcon, RetryIcon } from "../icons";
import { Markdown } from "./Markdown";

export function Message({
  role,
  text,
  follow,
  onRetry,
  onEdit,
}: {
  role: "user" | "assistant";
  text: string;
  follow?: boolean;
  appearance?: CompanionAppearance;
  onRetry?: () => void;
  onEdit?: (text: string) => void;
}) {
  return (
    <div className={`msg ${role}${follow ? " follow" : ""}`} tabIndex={0}>
      <div className={`bubble ${role}`}>
        {role === "assistant" ? <Markdown text={text} /> : text}
        <div className="msg-actions">
          <button type="button" aria-label="Copy" onClick={() => void navigator.clipboard?.writeText(text)}>
            <CopyIcon />
          </button>
          {role === "assistant" && onRetry && (
            <button type="button" aria-label="Retry" onClick={onRetry}><RetryIcon /></button>
          )}
          {role === "user" && onEdit && (
            <button type="button" aria-label="Edit" onClick={() => onEdit(text)}><PencilIcon /></button>
          )}
        </div>
      </div>
    </div>
  );
}
