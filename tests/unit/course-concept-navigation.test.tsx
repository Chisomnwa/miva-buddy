import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseDetailPage from "@/app/(workspace)/courses/[courseId]/page";
import LegacyGroundedLearnPage from "@/app/(workspace)/learn/course/[courseId]/[conceptId]/page";
import { orderConceptsByMaterial, type CourseConceptNavigationItem } from "@/components/course-concept-navigation";

type CoursePageConcept = CourseConceptNavigationItem & { description: string; extraction_version: string };

const { mockGetPermanentUser, mockNotFound, mockRedirect, mockQueries } = vi.hoisted(() => ({
  mockGetPermanentUser: vi.fn(),
  mockNotFound: vi.fn(),
  mockRedirect: vi.fn(),
  mockQueries: [] as { table: string; filters: [string, unknown][]; inFilters: [string, unknown[]][] }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/permanent-user", () => ({ getPermanentUser: mockGetPermanentUser }));
vi.mock("@/components/course-forms", () => ({
  MaterialForms: () => <div>Course material upload forms</div>,
  RemoveFailedMaterialForm: () => null,
  RetryMaterialForm: () => null,
}));
vi.mock("@/components/course-processing-refresh", () => ({ CourseProcessingRefresh: () => null }));
vi.mock("@/components/grounded-concept-learning-modes", () => ({
  GroundedConceptLearningModes: ({ conceptTitle, messages }: { conceptTitle: string; messages: unknown[] }) =>
    <div>Questions for {conceptTitle}; restored messages: {messages.length}</div>,
}));
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  redirect: (href: string) => mockRedirect(href),
}));

const materials = [
  { id: "material-first", title: "Lecture 1", kind: "pdf", status: "ready", failure_code: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
  { id: "material-second", title: "Lecture 2", kind: "notes", status: "ready", failure_code: null, created_at: "2026-10-02T00:00:00Z", updated_at: "2026-10-02T00:00:00Z" },
  { id: "material-pending", title: "Still processing", kind: "pdf", status: "processing", failure_code: null, created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" },
];
const concepts: CoursePageConcept[] = [
  { id: "concept-b", title: "Binary search", description: "Search a sorted sequence.", material_id: "material-first", ordinal: 1, extraction_version: "test-v1" },
  { id: "concept-pending", title: "Not ready yet", description: "Pending concept.", material_id: "material-pending", ordinal: 0, extraction_version: "test-v1" },
  { id: "concept-c", title: "A very long concept title that still wraps on smaller screens", description: "A long concept explanation.", material_id: "material-second", ordinal: 0, extraction_version: "test-v1" },
  { id: "concept-a", title: "Arrays", description: "Store values in an ordered sequence.", material_id: "material-first", ordinal: 0, extraction_version: "test-v1" },
];

function configureSupabaseMock({ conversation, messages, materialRows = materials, conceptRows = concepts, courseCode = "CS201" }: {
  conversation?: unknown;
  messages?: unknown[];
  materialRows?: typeof materials;
  conceptRows?: CoursePageConcept[];
  courseCode?: string | null;
} = {}) {
  mockQueries.splice(0);
  const responses = new Map<string, unknown[]>([
    ["courses", [{ data: { id: "course-123", title: "Algorithms", course_code: courseCode }, error: null }]],
    ["course_materials", [{ data: materialRows, error: null }]],
    ["course_concepts", [{ data: conceptRows, error: null }]],
    ["course_concept_sources", [{ data: [{ concept_id: "concept-b", chunk_id: "chunk-1" }], error: null }]],
    ["material_chunks", [{ data: [{ id: "chunk-1", page_start: 4, page_end: 5 }], error: null }]],
    ["learn_conversations", [{ data: conversation ?? null, error: null }]],
    ["learn_messages", [{ data: messages ?? [], error: null }]],
  ]);
  const supabase = {
    from(table: string) {
      const queryInfo = { table, filters: [] as [string, unknown][], inFilters: [] as [string, unknown[]][] };
      mockQueries.push(queryInfo);
      const response = responses.get(table)?.shift() ?? { data: [], error: null };
      const query: Record<string, (...args: never[]) => unknown> = {};
      for (const method of ["select", "order"]) query[method] = (() => query) as (...args: never[]) => unknown;
      query.eq = ((column: string, value: unknown) => { queryInfo.filters.push([column, value]); return query; }) as (...args: never[]) => unknown;
      query.in = ((column: string, values: unknown[]) => { queryInfo.inFilters.push([column, values]); return query; }) as (...args: never[]) => unknown;
      query.maybeSingle = (() => Promise.resolve(response)) as (...args: never[]) => unknown;
      query.then = ((resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve)) as (...args: never[]) => unknown;
      return query;
    },
  };
  mockGetPermanentUser.mockResolvedValue({ user: { id: "student-1" }, supabase });
}

describe("integrated course concept learning workspace", () => {
  beforeEach(() => {
    mockNotFound.mockImplementation(() => { throw new Error("not_found"); });
    mockRedirect.mockImplementation((href: string) => { throw new Error(`redirect:${href}`); });
    configureSupabaseMock();
  });

  it("orders ready concepts by material creation and extracted ordinal", () => {
    const readyOrder = materials.filter((material) => material.status === "ready");
    expect(orderConceptsByMaterial(readyOrder, concepts).map(({ id }) => id))
      .toEqual(["concept-a", "concept-b", "concept-c"]);
  });

  it("renders the selected concept and grounded modes on the course route with a right-side selector", async () => {
    const page = await CourseDetailPage({
      params: Promise.resolve({ courseId: "course-123" }),
      searchParams: Promise.resolve({ conceptId: "concept-b" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('<h1 class="course-workspace-title">Algorithms<span> - CS201</span></h1>');
    expect(html).not.toContain("Add a PDF or paste your notes. Concepts are identified");
    expect(html).toContain('class="course-learning-workspace"');
    expect(html).toContain('aria-label="Course concept navigation"');
    expect(html).toContain('href="/courses/course-123?conceptId=concept-a"');
    expect(html).toContain('aria-current="page">Binary search</span>');
    expect(html).toContain("Search a sorted sequence.");
    expect(html).toContain('href="/courses/course-123?conceptId=concept-c"');
    expect(html).toContain("<strong>Learning from your course material.</strong> Source references are tied to passages from Lecture 1.");
    expect(html).not.toContain("may be sent to the configured AI provider");
    expect(html).not.toContain("Not ready yet");
    expect(html).toContain("Questions for Binary search");
    expect(html).toContain("Source: pp. 4–5");
    expect(html).toContain("Course material upload forms");
    expect(html).toContain('class="eyebrow warm-brand-eyebrow">GROW THIS COURSE</p>');
    expect(html).not.toContain("COURSE MATERIALS");
    expect(html).not.toContain("Manage your materials");
    expect(html).not.toContain('aria-label="Uploaded course materials"');
    expect(html).not.toContain('href="/learn/course/course-123/concept-b"');
    const conceptsQuery = mockQueries.find((query) => query.table === "course_concepts");
    expect(conceptsQuery?.filters).toContainEqual(["course_id", "course-123"]);
    expect(conceptsQuery?.filters).toContainEqual(["user_id", "student-1"]);
  });

  it("does not add a separator when the course has no code", async () => {
    configureSupabaseMock({ courseCode: null });
    const page = await CourseDetailPage({
      params: Promise.resolve({ courseId: "course-123" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('<h1 class="course-workspace-title">Algorithms</h1>');
    expect(html).not.toContain("Algorithms - ");
  });

  it("defaults to the first ready concept and keeps material addition available when no concepts are ready", async () => {
    const defaultPage = await CourseDetailPage({
      params: Promise.resolve({ courseId: "course-123" }),
      searchParams: Promise.resolve({}),
    });
    expect(renderToStaticMarkup(defaultPage)).toContain('aria-current="page">Arrays</span>');

    configureSupabaseMock({
      materialRows: materials.map((material) => ({ ...material, status: "processing" })),
      conceptRows: [],
    });
    const noReadyConceptsPage = await CourseDetailPage({
      params: Promise.resolve({ courseId: "course-123" }),
      searchParams: Promise.resolve({}),
    });
    const noReadyConceptsHtml = renderToStaticMarkup(noReadyConceptsPage);
    expect(noReadyConceptsHtml).toContain("Once a course material is ready, its extracted concepts will appear here.");
    expect(noReadyConceptsHtml).toContain("Course material upload forms");
  });

  it("rejects a conversation that belongs to another concept and restores a matching conversation", async () => {
    configureSupabaseMock({
      conversation: { id: "conversation-1", course_id: "course-123", material_id: "material-second", concept_id: "concept-c" },
    });
    await expect(CourseDetailPage({
      params: Promise.resolve({ courseId: "course-123" }),
      searchParams: Promise.resolve({ conceptId: "concept-b", conversationId: "conversation-1" }),
    })).rejects.toThrow("not_found");

    configureSupabaseMock({
      conversation: { id: "conversation-2", course_id: "course-123", material_id: "material-first", concept_id: "concept-b" },
      messages: [{ id: "message-1", role: "assistant", content: "A saved answer", response_segments: [], follow_up_questions: [], grounding_status: "grounded" }],
    });
    const page = await CourseDetailPage({
      params: Promise.resolve({ courseId: "course-123" }),
      searchParams: Promise.resolve({ conceptId: "concept-b", conversationId: "conversation-2" }),
    });
    expect(renderToStaticMarkup(page)).toContain("Questions for Binary search; restored messages: 1");
  });

  it("redirects legacy concept URLs to the course workspace and preserves only supported context", async () => {
    await expect(LegacyGroundedLearnPage({
      params: Promise.resolve({ courseId: "course-123", conceptId: "concept-b" }),
      searchParams: Promise.resolve({ conversationId: "conversation-2", notice: "retry" }),
    })).rejects.toThrow("redirect:/courses/course-123?conceptId=concept-b&conversationId=conversation-2&notice=retry");
  });

  it("keeps the mobile navigator collapsible and the workspace free of horizontal overflow", () => {
    const styles = readFileSync(fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)), "utf8");
    expect(styles).toMatch(/\.course-learning-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 270px/);
    expect(styles).toMatch(/\.course-workspace-title\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(styles).toMatch(/\.course-learning-description\s*\{[^}]*max-width:\s*none/);
    expect(styles).toContain('grid-template-areas: "concept-nav" "concept-main"');
    expect(styles).toMatch(/\.course-concept-sidebar\s*\{[^}]*border-radius/);
    expect(styles).toContain(".course-concept-sidebar > summary { display: flex;");
    expect(styles).toMatch(/\.course-concept-selector-item\.is-current\s*\{[^}]*#bb9e7f/);
  });
});
