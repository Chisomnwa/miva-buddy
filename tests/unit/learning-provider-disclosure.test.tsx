import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import LearnConversationPage from "@/app/(workspace)/learn/[conversationId]/page";
import { PracticeCoach } from "@/components/practice-coach";

const { mockGetPermanentUser, mockGetLearnConversation } = vi.hoisted(() => ({
  mockGetPermanentUser: vi.fn(),
  mockGetLearnConversation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/permanent-user", () => ({ getPermanentUser: mockGetPermanentUser }));
vi.mock("@/lib/learning", () => ({ getLearnConversation: mockGetLearnConversation }));
vi.mock("@/components/learn-conversation", () => ({ LearnConversation: () => <div>Conversation history</div> }));
vi.mock("@/components/learn-composer", () => ({ LearnComposer: () => <div>General question composer</div> }));
vi.mock("@/app/actions/practice", () => ({ savePracticeModeAction: vi.fn() }));

describe("visible learning provider disclosures", () => {
  it("keeps the concise sensitive-information warning without technical provider details in general conversations", async () => {
    mockGetPermanentUser.mockResolvedValue({ user: { id: "student-1" } });
    mockGetLearnConversation.mockResolvedValue({ conversation: { title: "Binary trees" }, messages: [] });

    const page = await LearnConversationPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Avoid sharing sensitive personal information.");
    expect(html).not.toContain("configured AI provider");
    expect(html).not.toContain("up to 8 recent messages");
    expect(html).toContain("General question composer");
  });

  it("removes technical provider transport copy from Practice while retaining private-context guidance and coaching", () => {
    const html = renderToStaticMarkup(<PracticeCoach sessionId="session-1" initialMode="coach" initialMessages={[]} />);

    expect(html).not.toContain("configured AI provider");
    expect(html).toContain("Don’t include private information.");
    expect(html).toContain("Ask for coaching");
    expect(html).toContain("The selected mode limits the help Miva Buddy can give.");
  });
});
