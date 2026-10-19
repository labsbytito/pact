import { PactBlob } from "../companion/PactBlob";
import type { CompanionAppearance } from "../../lib/character";
import { CopyIcon, PencilIcon, RetryIcon } from "../icons";
import { Markdown } from "./Markdown";

export function Message({
  role,
  text,
  avatar,
  appearance,
  onRetry,
  onEdit,
}: {
  role: "user" | "assistant";
  text: string;
  avatar?: boolean;
  appearance?: CompanionAppearance;
  onRetry?: () => void;
  onEdit?: (text: string) => void;
}) {
  return (
    <div className={`msg ${role}`} tabIndex={0}>
      {avatar && <PactBlob size={24} state="still" appearance={appearance} />}
      <div className={`bubble ${role}`}>{role === "assistant" ? <Markdown text={text} /> : text}</div>
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
  );
}
