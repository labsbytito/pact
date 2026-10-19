import { Markdown } from "../chat/Markdown";

const DEMO = /this is a demo result, not a live fo reply\.?/i;

export function ResultCard({ text }: { text: string }) {
  const demo = DEMO.test(text);
  const body = text.replace(/^Fo replied with\s+/i, "").replace(DEMO, "").trim();
  const sentence = body.charAt(0).toUpperCase() + body.slice(1);
  return (
    <div className="msg assistant follow">
      <div className="bubble assistant" aria-label="Fo's reply">
        <Markdown text={sentence} />
        {demo && <p className="result-note">This is a demo result, not a live Fo reply.</p>}
      </div>
    </div>
  );
}
