import type { ReactNode } from "react";

/** Render plain text and fenced code without interpreting model output as HTML. */
export function MessageContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const fencedCode = /```([^\n`]*)\n([\s\S]*?)```/g;
  let cursor = 0;
  let index = 0;
  for (const match of content.matchAll(fencedCode)) {
    const start = match.index ?? 0;
    if (start > cursor) blocks.push(<span key={`text-${index++}`}>{content.slice(cursor, start)}</span>);
    blocks.push(<div className="code-example" key={`code-${index++}`}>
      {match[1].trim() && <span className="code-language">{match[1].trim()}</span>}
      <pre aria-label="Code example" className="learn-code-block" tabIndex={0}><code>{match[2]}</code></pre>
    </div>);
    cursor = start + match[0].length;
  }
  if (cursor < content.length || blocks.length === 0) blocks.push(<span key={`text-${index}`}>{content.slice(cursor)}</span>);
  return <>{blocks}</>;
}
