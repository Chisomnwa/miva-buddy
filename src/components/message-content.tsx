import type { ReactNode } from "react";

type MarkdownBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: string[][] }
  | { kind: "code"; language: string; text: string };

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: Extract<MarkdownBlock, { kind: "list" }> | undefined;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^\s*```([^`]*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      flushList();
      const codeLines: string[] = [];
      let closed = false;
      while (++index < lines.length) {
        if (/^\s*```\s*$/.test(lines[index])) {
          closed = true;
          break;
        }
        codeLines.push(lines[index]);
      }
      // An unfinished fence is still rendered as code, never interpreted as markup.
      blocks.push({ kind: "code", language: fence[1].trim(), text: codeLines.join("\n") + (closed ? "\n" : "") });
      continue;
    }

    const heading = /^\s*(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }

    const ordered = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (ordered || unordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (list && list.ordered !== isOrdered) flushList();
      if (!list) list = { kind: "list", ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] };
      list.items.push([ordered?.[2] ?? unordered![1]]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      let nextContentIndex = index + 1;
      while (nextContentIndex < lines.length && !lines[nextContentIndex].trim()) nextContentIndex += 1;
      const nextLine = lines[nextContentIndex] ?? "";
      const continuesList = list && (list.ordered
        ? /^\s*\d+[.)]\s+/.test(nextLine)
        : /^\s*[-*+]\s+/.test(nextLine));
      if (continuesList) continue;
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderLines(lines: string[], prefix: string): ReactNode[] {
  return lines.flatMap((line, index) => index === 0
    ? [line]
    : [<br key={`${prefix}-break-${index}`} />, line]);
}

/** Render a small, safe Markdown subset for Learn without interpreting model output as HTML. */
export function MessageContent({ content, markdown = false }: { content: string; markdown?: boolean }) {
  if (!markdown) {
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

  return <div className="learn-markdown-content">
    {parseMarkdownBlocks(content).map((block, index) => {
      if (block.kind === "paragraph") return <p className="learn-markdown-paragraph" key={`paragraph-${index}`}>{renderLines(block.lines, `paragraph-${index}`)}</p>;
      if (block.kind === "heading") {
        const Heading = `h${block.level + 2}` as "h3" | "h4" | "h5";
        return <Heading className="learn-markdown-heading" key={`heading-${index}`}>{block.text}</Heading>;
      }
      if (block.kind === "list") {
        const List = block.ordered ? "ol" : "ul";
        return <List className="learn-markdown-list" key={`list-${index}`} start={block.ordered && block.start !== 1 ? block.start : undefined}>
          {block.items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{renderLines(item, `list-${index}-${itemIndex}`)}</li>)}
        </List>;
      }
      return <div className="code-example" key={`code-${index}`}>
        {block.language && <span className="code-language">{block.language}</span>}
        <pre aria-label="Code example" className="learn-code-block" tabIndex={0}><code>{block.text}</code></pre>
      </div>;
    })}
  </div>;
}
