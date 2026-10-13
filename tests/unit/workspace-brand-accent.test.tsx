import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPermanentUser, mockCourses } = vi.hoisted(() => ({ mockGetPermanentUser: vi.fn(), mockCourses: [] as { id: string; title: string; course_code: string | null }[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/permanent-user", () => ({ getPermanentUser: mockGetPermanentUser }));
vi.mock("@/components/course-forms", () => ({
  CreateCourseForm: () => null,
  MaterialForms: () => null,
  RemoveFailedMaterialForm: () => null,
  RetryMaterialForm: () => null,
}));
vi.mock("@/components/course-processing-refresh", () => ({ CourseProcessingRefresh: () => null }));
vi.mock("@/components/practice-pattern-list", () => ({ PracticePatternList: () => null }));
vi.mock("@/components/practice-resume-section", () => ({ PracticeResumeSection: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));

import CoursesPage from "@/app/(workspace)/courses/page";
import CourseDetailPage from "@/app/(workspace)/courses/[courseId]/page";
import PracticePage from "@/app/(workspace)/practice/page";

function createSupabaseMock() {
  return {
    from: (table: string) => {
      const query: Record<string, (...args: unknown[]) => unknown> = {};
      for (const method of ["select", "eq", "order", "in"]) query[method] = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => ({
        data: { id: "course-1", title: "DSA", course_code: "CS201" },
        error: null,
      }));
      query.then = ((resolve: (value: unknown) => unknown) => Promise.resolve({
        data: table === "courses" ? mockCourses : table === "course_materials" ? [{ id: "material-1", title: "Lecture", kind: "pdf", status: "ready", failure_code: null, created_at: "2026-10-13T00:00:00Z" }] : [],
        error: null,
      }).then(resolve)) as (...args: unknown[]) => unknown;
      return query;
    },
  };
}

describe("workspace warm-brand accents", () => {
  beforeEach(() => {
    mockCourses.splice(0, mockCourses.length,
      { id: "course-coded", title: "Data Structures", course_code: "CS201" },
      { id: "course-no-code", title: "Programming Fundamentals", course_code: null },
    );
    mockGetPermanentUser.mockResolvedValue({
      user: { id: "student-1" },
      supabase: createSupabaseMock(),
    });
  });

  it("uses the warm brand eyebrow only for the Courses heading label", async () => {
    const html = renderToStaticMarkup(await CoursesPage());

    expect(html).toContain('class="eyebrow warm-brand-eyebrow">YOUR STUDY MATERIAL</p>');
    expect(html).toContain('class="eyebrow">ADD A COURSE</p>');
    expect(html).toContain('href="/courses/course-coded"');
    expect(html).toContain('Data Structures<span class="course-row-code"> - CS201</span>');
    expect(html).toContain("Programming Fundamentals</strong>");
    expect(html).not.toContain("Programming Fundamentals -");
    expect(html).toContain('class="course-row-arrow" aria-hidden="true">→</span>');
  });

  it("applies the warm brand color classes to the course back link and add-material eyebrow", async () => {
    const html = renderToStaticMarkup(await CourseDetailPage({
      params: Promise.resolve({ courseId: "course-1" }),
      searchParams: Promise.resolve({}),
    }));

    expect(html).toContain('class="back-link warm-brand-link" href="/courses">← All courses</a>');
    expect(html).toContain('class="eyebrow warm-brand-eyebrow">GROW THIS COURSE</p>');
    expect(html).not.toContain('class="eyebrow warm-brand-eyebrow">COURSE MATERIALS</p>');
  });

  it("keeps the requested amber rules more specific than the default back-link color", () => {
    const styles = readFileSync(fileURLToPath(new URL("../../src/app/globals.css", import.meta.url)), "utf8");

    expect(styles).toMatch(/\.card-symbol-warning\s*\{[^}]*color:\s*var\(--warning\)/);
    expect(styles).toMatch(/\.button-warning\s*\{[^}]*--button-warning-fill:\s*#bb9e7f;[^}]*background:\s*var\(--button-warning-fill\);[^}]*color:\s*white/);
    expect(styles).toMatch(/\.button-warning:hover\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--button-warning-fill\), black 12%\)/);
    expect(styles).toMatch(/\.back-link\.warm-brand-link\s*\{[^}]*color:\s*var\(--warning\)/);
    expect(styles).toMatch(/\.warm-brand-eyebrow\s*\{[^}]*color:\s*var\(--warning\)/);
    expect(styles).toMatch(/\.course-row-arrow\s*\{[^}]*color:\s*var\(--warning\)/);
    expect(styles).toContain(".course-row-title { min-width: 0; flex: 1 1 auto; }");
    expect(styles).toMatch(/\.course-row-title strong\s*\{[^}]*background:\s*color-mix\(in srgb, #bb9e7f 22%, white\);[^}]*color:\s*var\(--navy-900\)/);
    expect(styles).toMatch(/\.practice-pattern-description\s*\{[^}]*color:\s*var\(--warning\)/);
    expect(styles).toContain("overflow-wrap: anywhere");
  });

  it("uses the warm brand eyebrow for Practice without changing the page heading", async () => {
    const html = renderToStaticMarkup(await PracticePage());

    expect(html).toContain('class="eyebrow warm-brand-eyebrow">PRACTICE · DATA STRUCTURES &amp; ALGORITHMS</p>');
    expect(html).toContain("Choose a path to practise");
  });
});
