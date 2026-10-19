import { Markdown } from "../chat/Markdown";

export function ResultCard({ text }: { text: string }) {
  const body = text.replace(/^Fo replied with\s+/i, "");
  const sentence = body.charAt(0).toUpperCase() + body.slice(1);
  return (
    <section className="card" aria-label="Fo replied">
      <p className="result-label">Fo replied</p>
      <Markdown text={sentence} />
    </section>
  );
}
