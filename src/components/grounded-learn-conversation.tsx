import { groundedResponseSegmentSchema } from "@/contracts/grounded-learning";
import { GroundedSourceInspector } from "./grounded-source-inspector";
import { MessageContent } from "@/components/message-content";
import { CopyResponseButton } from "@/components/copy-response-button";

export type GroundedStoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response_segments: unknown;
  follow_up_questions: string[];
  grounding_status: string;
};

export function GroundedLearnConversation({ messages }: { messages: GroundedStoredMessage[] }) {
  return <div className="learn-transcript" aria-live="polite">
    {messages.map((message) => {
      const segments = message.role === "assistant" && Array.isArray(message.response_segments)
        ? message.response_segments.map((segment) => groundedResponseSegmentSchema.safeParse(segment))
          .filter((result) => result.success).map((result) => result.data)
        : [];
      return <article className={`learn-message ${message.role === "assistant" ? "learn-message-assistant" : "learn-message-student"}`} key={message.id}>
        <p className="eyebrow">{message.role === "assistant" ? "MIVA BUDDY" : "YOU"}</p>
        {message.role === "user" ? <div className="learn-message-content"><MessageContent content={message.content} /></div>
          : segments.length ? <div className="grounded-segments">{segments.map((segment, index) => <section className={`grounded-segment grounded-segment-${segment.kind}`} key={`${message.id}-${index}`}>
            <p className="grounding-label">{segment.kind === "grounded" ? "From your course material" : segment.kind === "no_support" ? "Not found in your course material" : "Additional explanation"}</p>
            <div className="learn-message-content"><MessageContent content={segment.content} /></div>
            {segment.kind === "grounded" && <div className="grounded-citations" aria-label="Supporting sources">
              <span className="source-group-label">Supporting sources</span>
              {segment.citationIds.map((sourceId) => <GroundedSourceInspector key={sourceId} sourceId={sourceId} label="Inspect source" />)}
            </div>}
          </section>)}</div>
          : <section className="grounded-segment grounded-segment-additional"><p className="grounding-label">Additional explanation</p><div className="learn-message-content"><MessageContent content={message.content} /></div></section>}
        {message.role === "assistant" && <div className="message-actions"><CopyResponseButton content={message.content} /></div>}
      </article>;
    })}
  </div>;
}
