import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/(workspace)/home/page";
vi.mock("server-only", () => ({}));

const { mockGetRecent, mockGetProfile, mockQueryLimits, mockQueryOrders } = vi.hoisted(() => ({
  mockGetRecent: vi.fn(),
  mockGetProfile: vi.fn(),
  mockQueryLimits: new Map<string, number>(),
  mockQueryOrders: new Map<string, unknown[]>(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "student-1", is_anonymous: false, user_metadata: {} } } }) },
    from: (table: string) => {
      const query: Record<string, (...args: unknown[]) => unknown> = {};
      for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
      query.order = vi.fn((...args: unknown[]) => {
        const orders = mockQueryOrders.get(table) ?? [];
        orders.push(args);
        mockQueryOrders.set(table, orders);
        return query;
      });
      query.limit = vi.fn(((limit: number) => {
        mockQueryLimits.set(table, limit);
        return query;
      }) as (...args: unknown[]) => unknown);
      query.then = ((resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === "practice_sessions" ? [
          { id: "session-1", problem_slug: "two-sum", topic_id: "arrays-hashing", mode: "coach", updated_at: "2026-10-09T12:00:00Z" },
          { id: "session-2", problem_slug: "contains-duplicate", topic_id: "arrays-hashing", mode: "tutor", updated_at: "2026-10-09T11:00:00Z" },
          { id: "session-3", problem_slug: "valid-anagram", topic_id: "arrays-hashing", mode: "hands_off", updated_at: "2026-10-09T10:00:00Z" },
          { id: "session-4", problem_slug: "group-anagrams", topic_id: "arrays-hashing", mode: "coach", updated_at: "2026-10-09T09:00:00Z" },
        ] : [],
        error: null,
      }).then(resolve)) as (...args: unknown[]) => unknown;
      return query;
    },
  }),
}));
vi.mock("@/lib/profile", () => ({ getProfile: mockGetProfile }));
vi.mock("@/lib/learning", () => ({ getRecentLearnConversations: mockGetRecent }));

describe("Home activity lists", () => {
  beforeEach(() => {
    mockQueryLimits.clear();
    mockQueryOrders.clear();
    mockGetProfile.mockResolvedValue({ data: null, error: null });
    mockGetRecent.mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({
      id: `conversation-${index + 1}`,
      title: `Learning conversation ${index + 1}`,
      updated_at: new Date(Date.UTC(2026, 9, 9, 12 - index)).toISOString(),
    })));
  });

  it("fetches bounded recent activity and renders compact, expandable lists with existing links and order", async () => {
    const page = await HomePage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain('class="eyebrow warm-brand-eyebrow">YOUR LEARNING COMPANION</p>');
    for (const number of ["01", "02", "03"]) {
      expect(html).toContain(`class="card-symbol card-symbol-warning" aria-hidden="true">${number}</span>`);
    }

    expect(mockQueryLimits.get("practice_sessions")).toBe(10);
    expect(mockQueryOrders.get("practice_sessions")).toContainEqual(["updated_at", { ascending: false }]);
    expect(mockGetRecent).toHaveBeenCalledWith("student-1", 6);

    expect(html).toContain("Continue Practice");
    expect(html).toContain('href="/practice"');
    expect(html).toContain('href="/practice/session/session-1"');
    expect(html).toContain("Arrays &amp; Hashing · Coach");
    expect(html).toContain("Show 1 more question");
    expect(html.indexOf("Two Sum")).toBeLessThan(html.indexOf("Contains Duplicate"));
    expect(html.indexOf("Contains Duplicate")).toBeLessThan(html.indexOf("Valid Anagram"));
    expect(html).not.toContain("href=\"/practice/session/session-4\"");

    expect(html).toContain("Recent learning");
    expect(html).toContain('href="/learn/conversation-1"');
    expect(html).toContain("Show 2 more conversations");
    expect(html.indexOf("Learning conversation 1")).toBeLessThan(html.indexOf("Learning conversation 2"));
    expect(html).toContain('href="/learn/conversation-5"');
  });
});
