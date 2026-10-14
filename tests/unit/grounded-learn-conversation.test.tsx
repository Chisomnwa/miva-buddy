import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroundedLearnConversation } from "@/components/grounded-learn-conversation";

vi.mock("@/app/actions/grounded-source", () => ({ getGroundedSourceAction: vi.fn() }));

const sourceId = "00000000-0000-4000-8000-000000000001";

describe("grounded FIFO walkthrough rendering", () => {
  it("labels the cited FIFO rule and the uncited complete illustrative dry run separately", () => {
    const dryRun = [
      "Illustrative dry run (A, B, and C are example values, not a trace from the lecture):",
      "### Queue state after each operation",
      "1. Enqueue A: [A].",
      "2. Enqueue B: [A, B].",
      "3. Enqueue C: [A, B, C].",
      "4. Dequeue A: [B, C].",
      "5. Dequeue B: [C].",
      "6. Dequeue C: [].",
      "```text",
      "Enqueue A -> [A]",
      "Enqueue B -> [A, B]",
      "Enqueue C -> [A, B, C]",
      "Dequeue A -> [B, C]",
      "Dequeue B -> [C]",
      "Dequeue C -> []",
      "```",
    ].join("\n");
    const html = renderToStaticMarkup(<GroundedLearnConversation messages={[{
      id: "00000000-0000-4000-8000-000000000010",
      role: "assistant",
      content: `A FIFO queue removes the earliest item.\n\n${dryRun}`,
      response_segments: [
        { kind: "grounded", content: "A FIFO queue removes the item added first.", citationIds: [sourceId] },
        { kind: "additional", content: dryRun, citationIds: [] },
      ],
      follow_up_questions: [],
      grounding_status: "supporting_evidence_found",
    }]} />);

    expect(html).toContain("From your course material");
    expect(html).toContain("Supporting sources");
    expect(html).toContain(">Inspect source</button>");
    expect(html).toContain("Additional explanation");
    expect(html).toContain("Illustrative dry run (A, B, and C are example values, not a trace from the lecture):");
    expect(html).toContain("<h5 class=\"learn-markdown-heading\">Queue state after each operation</h5>");
    expect(html).toContain("<ol class=\"learn-markdown-list\">");
    expect(html).toContain("Dequeue A -&gt; [B, C]");
    expect(html).toContain("Dequeue B -&gt; [C]");
    expect(html).toContain("Dequeue C -&gt; []");
  });

  it("highlights technical terms inside cited course explanations without changing citation rendering", () => {
    const html = renderToStaticMarkup(<GroundedLearnConversation messages={[{
      id: "00000000-0000-4000-8000-000000000011",
      role: "assistant",
      content: "A FIFO queue removes the item added first.",
      response_segments: [{ kind: "grounded", content: "A **FIFO queue** removes the item added first.", citationIds: [sourceId] }],
      follow_up_questions: [],
      grounding_status: "supporting_evidence_found",
    }]} />);

    expect(html).toContain('<strong class="learn-technical-term">FIFO queue</strong>');
    expect(html).toContain("From your course material");
    expect(html).toContain("Supporting sources");
  });
});
