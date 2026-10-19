import { Markdown } from "../chat/Markdown";

export function ResultCard({ text }: { text: string }) {
  return (
    <section className="card" aria-label="Fo replied">
      <h3>Fo replied</h3>
      <Markdown text={text} />
    </section>
  );
}
