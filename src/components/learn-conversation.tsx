import type { ReactNode } from "react";
import type { LearnStoredMessage } from "@/contracts/learning";

function renderMessageContent(content: string) {
  const blocks: ReactNode[] = [];
  const fencedCode = /```[^\n`]*\n([\s\S]*?)```/g;
  let cursor = 0;
  let index = 0;

  for (const match of content.matchAll(fencedCode)) {
    const start = match.index ?? 0;
    if (start > cursor) blocks.push(<span key={`text-${index++}`}>{content.slice(cursor, start)}</span>);
    blocks.push(
      <pre aria-label="Code example" className="learn-code-block" key={`code-${index++}`} tabIndex={0}>
        <code>{match[1]}</code>
      </pre>,
    );
    cursor = start + match[0].length;
  }

  if (cursor < content.length || blocks.length === 0) {
    blocks.push(<span key={`text-${index}`}>{content.slice(cursor)}</span>);
  }

  return blocks;
}

export function LearnConversation({ messages }: { messages: LearnStoredMessage[] }) {
  return (
    <div className="learn-transcript" aria-live="polite">
      {messages.map((message) => (
        <article className={`learn-message ${message.role === "assistant" ? "learn-message-assistant" : "learn-message-student"}`} key={message.id}>
          <p className="eyebrow">{message.role === "assistant" ? "MIVA BUDDY" : "YOU"}</p>
          <div className="learn-message-content">{renderMessageContent(message.content)}</div>
        </article>
      ))}
    </div>
  );
}
