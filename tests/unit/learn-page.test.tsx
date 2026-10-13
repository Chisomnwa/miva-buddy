import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LearnPage from "@/app/(workspace)/learn/page";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/learning", () => ({
  getRecentLearnConversations: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("Learn landing page", () => {
  it("uses the concise privacy note and places interview guidance before suggestions inside the general composer", async () => {
    const page = await LearnPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Avoid sharing sensitive personal information.");
    expect(html).not.toContain("Your question and a limited amount of recent conversation");
    expect(html).not.toContain("General explanation");
    expect(html).not.toContain("No course material is attached to this conversation.");
    expect(html).toContain("Learn with your notes");
    expect(html).toContain('class="eyebrow warm-brand-eyebrow">YOUR COURSE MATERIAL</p>');
    expect(html).toContain('<a class="button button-warning" href="/courses">Browse Courses <span aria-hidden="true">→</span></a>');
    expect(html).toContain("Ask a question about a company, role, or interview stage. Preparation is general guidance; external searches are not verified candidate experiences.");

    const questionCard = html.slice(html.indexOf('aria-labelledby="learn-ask-heading"'));
    expect(questionCard.indexOf("Avoid sharing sensitive personal information.")).toBeLessThan(questionCard.indexOf("Preparing for an interview?"));
    expect(questionCard.indexOf("Preparing for an interview?")).toBeLessThan(questionCard.indexOf("Try a question"));
    expect(questionCard).toContain('id="learn-message"');
    expect(questionCard).toContain("Start voice input");
    expect(questionCard).not.toContain("Browser speech recognition may use your browser vendor’s speech service");
    expect(questionCard).toContain(">Send</button>");
    expect(html.indexOf("Learn with your notes")).toBeLessThan(html.indexOf("Ask a general question"));
    expect(html).toContain('class="eyebrow">LEARN</p>');
  });
});
