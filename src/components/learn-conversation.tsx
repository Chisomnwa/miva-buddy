import type { LearnStoredMessage } from "@/contracts/learning";
import { MessageContent } from "@/components/message-content";
import { CopyResponseButton } from "@/components/copy-response-button";
import { InterviewPreparationCard } from "@/components/interview-preparation-card";
import { recoverPreviousInterviewPreparationSegment } from "@/server/interview-preparation/prepare";

type LearnMessageForDisplay = Omit<LearnStoredMessage, "response_segments"> & { response_segments?: unknown[] };

export function LearnConversation({ messages }: { messages: LearnMessageForDisplay[] }) {
  return (
    <div className="learn-transcript" aria-live="polite">
      {messages.map((message, messageIndex) => {
        const interviewSegment = message.role === "assistant" ? message.response_segments?.find((segment) =>
          typeof segment === "object" && segment !== null && "kind" in segment && segment.kind === "interview_preparation",
        ) : undefined;
        const resolvedInterviewSegment = interviewSegment
          ? recoverPreviousInterviewPreparationSegment(
            [interviewSegment],
            messages.slice(0, messageIndex).filter((previous) => previous.role === "user").map((previous) => previous.content),
          ) ?? interviewSegment
          : undefined;
        return <article className={`learn-message ${message.role === "assistant" ? "learn-message-assistant" : "learn-message-student"}`} key={message.id}>
          {(message.role !== "assistant" || !interviewSegment) && <p className="eyebrow">{message.role === "assistant" ? "MIVA BUDDY" : "YOU"}</p>}
          {resolvedInterviewSegment ? <InterviewPreparationCard value={resolvedInterviewSegment} id={message.id} />
            : <div className="learn-message-content"><MessageContent content={message.content} markdown={message.role === "assistant"} /></div>}
          {message.role === "assistant" && !interviewSegment && <div className="message-actions"><CopyResponseButton content={message.content} /></div>}
        </article>;
      })}
    </div>
  );
}
