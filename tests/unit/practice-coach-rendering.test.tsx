import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PracticeCoach } from "@/components/practice-coach";

vi.mock("@/app/actions/practice", () => ({ savePracticeModeAction: vi.fn() }));

describe("Practice coach explanation rendering", () => {
  it("uses shared safe term and identifier formatting for prose segments", () => {
    const html = renderToStaticMarkup(<PracticeCoach
      sessionId="00000000-0000-4000-8000-000000000001"
      initialMode="coach"
      readOnly
      initialMessages={[{
        id: "00000000-0000-4000-8000-000000000002",
        role: "assistant",
        content: "",
        attempt: null,
        response: { segments: [{
          kind: "idea",
          content: "A **hash table** supports `lookup()`.",
          format: "prose",
          references: [],
        }] },
      }]}
    />);

    expect(html).toContain('<strong class="learn-technical-term">hash table</strong>');
    expect(html).toContain('<code class="learn-inline-code">lookup()</code>');
  });

  it("does not interpret structured code segments as Markdown", () => {
    const html = renderToStaticMarkup(<PracticeCoach
      sessionId="00000000-0000-4000-8000-000000000001"
      initialMode="tutor"
      readOnly
      initialMessages={[{
        id: "00000000-0000-4000-8000-000000000002",
        role: "assistant",
        content: "",
        attempt: null,
        response: { segments: [{
          kind: "complete_answer",
          content: "**function solve()**",
          format: "code",
          references: [],
        }] },
      }]}
    />);

    expect(html).toContain("**function solve()**");
    expect(html).not.toContain("class=\"learn-technical-term\"");
  });
});
