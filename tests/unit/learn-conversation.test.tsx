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

  it("renders paragraphs, headings, numbered steps, lists, and fenced dry-run traces safely", () => {
    const content = [
      "## FIFO dry run",
      "",
      "A queue is processed in order.",
      "Line breaks within a paragraph are retained.",
      "",
      "Each operation updates the front of the queue.",
      "",
      "1. Enqueue A.",
      "",
      "2. Enqueue B.",
      "",
      "3. Dequeue A.",
      "",
      "- The front item leaves first.",
      "",
      "- The remaining item stays queued.",
      "",
      "```text",
      "[A, B] -> [B] -> []",
      "```",
    ].join("\n");
    const html = renderToStaticMarkup(
      <LearnConversation messages={[{ ...message, content }]} />,
    );

    expect(html).toContain("<h4 class=\"learn-markdown-heading\">FIFO dry run</h4>");
    expect(html).toContain("<p class=\"learn-markdown-paragraph\">A queue is processed in order.<br/>Line breaks within a paragraph are retained.</p>");
    expect(html).toContain("<p class=\"learn-markdown-paragraph\">Each operation updates the front of the queue.</p>");
    expect(html).toContain("<ol class=\"learn-markdown-list\">");
    expect(html).toContain("<ul class=\"learn-markdown-list\">");
    expect(html.match(/<ol class=\"learn-markdown-list\"/g)).toHaveLength(1);
    expect(html).toContain("<pre aria-label=\"Code example\" class=\"learn-code-block\" tabindex=\"0\"><code>[A, B] -&gt; [B] -&gt; []\n</code></pre>");
  });

  it("renders model-provided markup as text rather than executable HTML", () => {
    const html = renderToStaticMarkup(
      <LearnConversation messages={[{ ...message, content: '<script>alert("x")</script>' }]} />,
    );

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("highlights concise technical terms and code identifiers while preserving paragraphs", () => {
    const html = renderToStaticMarkup(<LearnConversation messages={[{
      ...message,
      content: "A **finite state machine** models transitions. `accelerate()` is a method on `Vehicle`.\n\nOrdinary words remain unhighlighted, while **recursion** names a concept.",
    }]} />);

    expect(html).toContain('<strong class="learn-technical-term">finite state machine</strong>');
    expect(html).toContain('<code class="learn-inline-code">accelerate()</code>');
    expect(html).toContain('<code class="learn-inline-code">Vehicle</code>');
    expect(html).toContain('<p class="learn-markdown-paragraph">Ordinary words remain unhighlighted');
    expect(html).toContain('<strong class="learn-technical-term">recursion</strong>');
    expect(html.match(/class="learn-markdown-paragraph"/g)).toHaveLength(2);
    expect(html).not.toContain('<strong class="learn-technical-term">Ordinary words</strong>');
  });

  it("keeps malformed inline markers and hostile markup as escaped text", () => {
    const html = renderToStaticMarkup(<LearnConversation messages={[{
      ...message,
      content: "A **valid term** and **unfinished emphasis <img src=x onerror=alert(1)>",
    }]} />);

    expect(html).toContain('<strong class="learn-technical-term">valid term</strong>');
    expect(html).toContain("**unfinished emphasis &lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });

  it("renders the persisted interview-preparation state as a distinct general-guidance card", () => {
    const segment = buildInterviewPreparation({ message: "I have an interview at Coinbase for a backend engineering internship. Help me prepare." });
    const html = renderToStaticMarkup(<LearnConversation messages={[{
      ...message,
      content: interviewMessageContent(segment!),
      response_segments: [segment],
    }]} />);
    expect(html).toContain("General interview preparation</h2>");
    expect(html).toContain("Company: <strong>Coinbase</strong>");
    expect(html).toContain("General mock prompts — not company questions");
    expect(html).not.toContain("Coinbase uses");
  });

  it("recovers and renders corrected context for an existing saved conversation", () => {
    const original = buildInterviewPreparation({ message: "I have an onsite interview at coinbase." })!;
    const staleSegment = { ...original, company: "Coinbase looks like" };
    const userMessages = [
      "I have an onsite interview at coinbase.",
      "It's a software engineering internship role.",
      "I want to know what interviewing at Coinbase looks like.",
    ];
    const messages = [
      ...userMessages.map((content, index) => ({
        ...message,
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        role: "user" as const,
        content,
      })),
      { ...message, content: "Old saved preparation response", response_segments: [staleSegment] },
      { ...message, id: "0d7718f0-b522-4f4d-9d5e-a764d75857ab", content: "A regular explanation." },
    ];

    const html = renderToStaticMarkup(<LearnConversation messages={messages} />);
    expect(html).toContain("Company: <strong>Coinbase</strong>");
    expect(html).not.toContain("Company: <strong>Coinbase looks like</strong>");
    expect(html).toContain("Role: <strong>Software Engineering Internship</strong>");
    expect(html).toContain("Stage: <strong>On-site interview</strong>");
    expect(html).toContain("INTERVIEW PREPARATION");
    expect(html).not.toContain("MIVA BUDDY</p><section class=\"interview-preparation-card");
    expect(html).toContain('<p class="eyebrow">MIVA BUDDY</p><div class="learn-message-content"><div class="learn-markdown-content"><p class="learn-markdown-paragraph">A regular explanation.</p></div></div>');
  });
});
