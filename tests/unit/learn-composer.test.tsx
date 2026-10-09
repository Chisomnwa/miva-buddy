import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LearnComposer } from "@/components/learn-composer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("LearnComposer", () => {
  it("places the interview-preparation prompt before suggested questions and keeps composer controls", () => {
    const html = renderToStaticMarkup(
      <LearnComposer
        beforeSuggestions={
          <aside className="learn-interview-prompt" aria-label="Interview preparation">
            <h3>Preparing for an interview?</h3>
            <p>Ask a question about a company, role, or interview stage. Preparation is general guidance; external searches are not verified candidate experiences.</p>
          </aside>
        }
        suggestions={["Explain recursion", "How do hash tables work?"]}
      />,
    );

    expect(html.indexOf("Preparing for an interview?")).toBeLessThan(html.indexOf("Try a question"));
    expect(html).toContain("external searches are not verified candidate experiences.");
    expect(html).toContain('id="learn-message"');
    expect(html).toContain("Start voice input");
    expect(html).toContain("Up to 2,000 characters");
    expect(html).toContain(">Send</button>");
    expect(html).toContain("Explain recursion");
    expect(html).toContain("How do hash tables work?");
  });
});
