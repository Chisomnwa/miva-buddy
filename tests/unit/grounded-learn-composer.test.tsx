import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroundedLearnComposer } from "@/components/grounded-learn-composer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("GroundedLearnComposer voice input", () => {
  it("reuses optional browser voice input while keeping transcript review and manual submission", () => {
    const html = renderToStaticMarkup(
      <GroundedLearnComposer courseId="course" materialId="material" conceptId="concept" />,
    );

    expect(html).toContain('id="grounded-learn-message"');
    expect(html).toContain('type="button"');
    expect(html).toContain("Start voice input");
    expect(html).not.toContain("Browser speech recognition may use your browser vendor’s speech service.");
    expect(html).not.toContain("Miva Buddy does not record or store raw audio.");
    expect(html.indexOf("Start voice input")).toBeLessThan(html.indexOf(">Send</button>"));
    expect(html).toContain(">Send</button>");
  });
});
