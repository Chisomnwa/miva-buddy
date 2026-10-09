import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LearnConversation } from "@/components/learn-conversation";
import { buildInterviewPreparation, interviewMessageContent } from "@/server/interview-preparation/prepare";

const message = {
  id: "0d7718f0-b522-4f4d-9d5e-a764d75857ac",
  role: "assistant" as const,
  follow_up_questions: [],
  created_at: "2026-10-07T00:00:00.000Z",
};

describe("Learn conversation rendering", () => {
  it("renders fenced code as a horizontally contained semantic code block", () => {
    const html = renderToStaticMarkup(
      <LearnConversation messages={[{ ...message, content: "A small example:\n\n```js\nconst answer = 42;\n```\nThen inspect the result." }]} />,
    );

    expect(html).toContain("A small example:");
    expect(html).toContain('<pre aria-label="Code example" class="learn-code-block" tabindex="0"><code>const answer = 42;\n</code></pre>');
    expect(html).toContain("Then inspect the result.");
  });

  it("renders model-provided markup as text rather than executable HTML", () => {
    const html = renderToStaticMarkup(
      <LearnConversation messages={[{ ...message, content: '<script>alert("x")</script>' }]} />,
    );

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders the persisted interview-preparation state as a distinct general-guidance card", () => {
    const segment = buildInterviewPreparation({ message: "I have an interview at Coinbase for a backend engineering internship. Help me prepare." });
    const html = renderToStaticMarkup(<LearnConversation messages={[{
      ...message,
      content: interviewMessageContent(segment!),
      response_segments: [segment],
    }]} />);
    expect(html).toContain("General interview preparation—not company-specific");
    expect(html).toContain("Company: <strong>Coinbase</strong>");
    expect(html).toContain("General mock prompts—not company questions");
    expect(html).not.toContain("Coinbase uses");
  });
});
