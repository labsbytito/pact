import { renderMarkdown } from "../../lib/markdown";

export function Markdown({ text }: { text: string }) {
  return <>{renderMarkdown(text)}</>;
}
