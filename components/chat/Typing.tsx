import { useEffect, useState } from "react";

const phrases = ["Thinking it over", "Reading the page", "Writing a reply"];

export function Typing() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % phrases.length), 1600);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="typing" role="status">
      <span className="dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{phrases[index]}</span>
    </div>
  );
}
