import type { ReactNode } from "react";
import { safeUrl } from "./model";

/** Safe markdown → React. Links go through safeUrl; no raw HTML. */
export function renderMarkdown(text: string): ReactNode[] {
  const blocks = text.split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  blocks.forEach((block, bi) => {
    const trimmed = block.trimEnd();
    if (!trimmed) return;
    const lines = trimmed.split("\n");
    const listItems = lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l));
    if (listItems) {
      nodes.push(
        <ul key={`ul-${bi}`} className="md-list">
          {lines.map((line, li) => (
            <li key={li}>
              {inlineMarkdown(line.replace(/^\s*([-*]|\d+\.)\s+/, ""))}
            </li>
          ))}
        </ul>,
      );
      return;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      const level = Math.min(3, trimmed.match(/^#+/)?.[0].length ?? 1);
      const Tag = (`h${level + 2}` as "h3" | "h4" | "h5");
      nodes.push(
        <Tag key={`h-${bi}`} className="md-heading">
          {inlineMarkdown(trimmed.replace(/^#{1,3}\s+/, ""))}
        </Tag>,
      );
      return;
    }
    if (/^>\s?/.test(trimmed)) {
      nodes.push(
        <blockquote key={`q-${bi}`} className="md-quote">
          {inlineMarkdown(trimmed.replace(/^(>\s?)+/gm, ""))}
        </blockquote>,
      );
      return;
    }
    if (/^```/.test(trimmed)) {
      const body = trimmed.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
      nodes.push(
        <pre key={`code-${bi}`} className="md-code">
          <code>{body}</code>
        </pre>,
      );
      return;
    }
    nodes.push(
      <p key={`p-${bi}`} className="md-p">
        {lines.map((line, li) => (
          <span key={li}>
            {li > 0 ? <br /> : null}
            {inlineMarkdown(line)}
          </span>
        ))}
      </p>,
    );
  });
  return nodes;
}

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let previous = 0;
  const re =
    /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s<>"`]+)\)|https?:\/\/[^\s<>"`*]+)/g;
  for (const match of text.matchAll(re)) {
    const start = match.index!;
    if (start > previous) nodes.push(text.slice(previous, start));
    if (match[2]) {
      nodes.push(<strong key={start}>{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={start}>{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(
        <code key={start} className="md-inline-code">
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      const href = safeUrl(match[6]);
      if (href)
        nodes.push(
          <a key={start} href={href} target="_blank" rel="noopener noreferrer">
            {match[5]}
          </a>,
        );
      else nodes.push(match[0]);
    } else {
      let candidate = match[0].replace(/[.,;:!?]+$/, "");
      while (
        candidate.endsWith(")") &&
        (candidate.match(/\)/g)?.length ?? 0) >
          (candidate.match(/\(/g)?.length ?? 0)
      )
        candidate = candidate.slice(0, -1);
      const url = safeUrl(candidate);
      if (url)
        nodes.push(
          <a key={start} href={url} target="_blank" rel="noopener noreferrer">
            {candidate}
          </a>,
        );
      else nodes.push(match[0]);
      previous = start + (url ? candidate.length : match[0].length);
      continue;
    }
    previous = start + match[0].length;
  }
  if (previous < text.length) nodes.push(text.slice(previous));
  return nodes;
}
