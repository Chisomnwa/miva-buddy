import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, remoteSearch } = vi.hoisted(() => ({
  createClient: vi.fn(),
  remoteSearch: vi.fn(),
}));

vi.mock("@/lib/same-origin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/config", () => ({ getServerConfig: () => ({ AI_PROVIDER: "fake" }) }));
vi.mock("@/server/ai/create-provider", () => ({ createGenerationProvider: () => ({}) }));
vi.mock("@/server/ai/grounded-learning", () => ({
  generateGroundedLearningReply: async () => ({
    segments: [{ kind: "additional", content: "Synthetic lesson explanation.", citationIds: [] }],
    followUpQuestions: [],
  }),
  isMaterialSpecificQuestion: () => false,
  noCourseSupportReply: () => ({ segments: [], followUpQuestions: [] }),
}));
vi.mock("@/server/retrieval/course-retrieval", () => ({
  CourseRetrievalUnavailableError: class CourseRetrievalUnavailableError extends Error {},
  retrieveCourseEvidence: async () => ({
    status: "supporting_evidence_found",
    chunks: [{
      chunk_id: "00000000-0000-4000-8000-000000000001",
      course_id: "00000000-0000-4000-8000-000000000002",
      material_id: "00000000-0000-4000-8000-000000000003",
      content: "Synthetic course passage about Python programming.",
      page_start: 1,
      page_end: 1,
      rank_score: 1,
      semantic_similarity: 1,
      lexical_match: true,
      supports_current_concept: true,
    }],
  }),
}));
vi.mock("@/server/job-evidence/demo", () => ({ createIndustryDemonstration: () => null }));
vi.mock("@/server/job-evidence/remoteok-provider", () => ({
  createRemoteOkJobEvidenceProvider: () => ({ search: remoteSearch }),
  isRemoteOkMetadataPilotEnabled: () => true,
  remoteOkMetadataGrant: { retrieve: "permitted", display_metadata: "permitted", display_excerpt: "unclear", cache: "unclear" },
}));
vi.mock("@/server/job-evidence/himalayas-provider", () => ({
  createHimalayasJobEvidenceProvider: () => ({ search: vi.fn() }),
  isHimalayasMetadataEnabled: () => false,
}));
vi.mock("@/server/job-evidence/skills", () => ({ skillsExplicitlyInCourse: () => ["Python"] }));
vi.mock("@/server/observability/safe-telemetry", () => ({ recordSafeOperation: vi.fn() }));

import { POST } from "@/app/api/learn/grounded/route";

function supabaseMock() {
  const insertMessage = vi.fn().mockResolvedValue({ error: null });
  const builders: Record<string, unknown> = {};
  const rows: Record<string, unknown> = {
    courses: { id: "00000000-0000-4000-8000-000000000002", title: "Synthetic course" },
    course_materials: { id: "00000000-0000-4000-8000-000000000003", status: "ready" },
    course_concepts: { id: "00000000-0000-4000-8000-000000000004", title: "Python" },
    learn_conversations: {
      id: "00000000-0000-4000-8000-000000000005",
      course_id: "00000000-0000-4000-8000-000000000002",
      material_id: "00000000-0000-4000-8000-000000000003",
      concept_id: "00000000-0000-4000-8000-000000000004",
    },
  };

  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn((_: unknown, options?: { head?: boolean }) => {
        builders[table] = options?.head ? { count: 0, error: null }
          : table === "learn_messages" ? { data: [], error: null }
            : { data: rows[table], error: null };
        return builder;
      }),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: rows[table], error: null })),
      insert: vi.fn(() => {
        insertMessage();
        return { select: () => ({ single: async () => ({ data: { id: "new-conversation" }, error: null }) }),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
      }),
      update: vi.fn(() => {
        const finalQuery = Promise.resolve({ error: null });
        const finalFilter = { eq: vi.fn(() => finalQuery) };
        return { eq: vi.fn(() => finalFilter) };
      }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(builders[table]).then(resolve),
    };
    return builder;
  });

  createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000006" } } }) },
    from,
  });
  return { insertMessage };
}

describe("grounded lesson availability when optional job evidence fails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock();
    remoteSearch.mockResolvedValue({ status: "failed", retryable: true });
  });

  it("returns the lesson successfully even when Remote OK evidence retrieval fails", async () => {
    const request = new Request("https://miva.example/api/learn/grounded", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://miva.example" },
      body: JSON.stringify({
        conversationId: "00000000-0000-4000-8000-000000000005",
        courseId: "00000000-0000-4000-8000-000000000002",
        materialId: "00000000-0000-4000-8000-000000000003",
        conceptId: "00000000-0000-4000-8000-000000000004",
        message: "Explain Python variables",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversationId).toBe("00000000-0000-4000-8000-000000000005");
    expect(body.industryReferences).toEqual({ status: "failed", retryable: true });
    expect(remoteSearch).toHaveBeenCalledOnce();
  });
});
