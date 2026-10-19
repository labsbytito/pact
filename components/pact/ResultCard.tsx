import { Markdown } from "../chat/Markdown";

export function ResultCard({ text }: { text: string }) {
  const body = text
    .replace(/^Fo replied with\s+/i, "")
    .replace(/\s*This is a demo result, not a live Fo reply\.?/i, "")
    .trim();
  const sentence = body.charAt(0).toUpperCase() + body.slice(1);
  return (
    <div className="msg assistant">
      <div className="bubble assistant"><Markdown text={sentence} /></div>
    </div>
  );
}
