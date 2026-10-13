import { Pool } from "pg";
import { loadEnvConfig } from "@next/env";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const enabled = process.env.RUN_HOSTED_SUPABASE_TESTS === "1";

function syntheticPdf(text: string, pageCount = 1) {
  const safeText = text.replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 12 Tf 40 100 Td (${safeText}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...Array.from({ length: pageCount }, (_, index) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 144] /Resources << /Font << /F1 ${3 + pageCount * 2} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ]).flat(),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function sessionFromCookies(cookies: Array<{ name: string; value: string }>) {
  const authCookies = cookies.filter((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const encoded = authCookies.map((cookie) => cookie.value).join("");
  const decoded = encoded.startsWith("base64-")
    ? Buffer.from(encoded.slice("base64-".length), "base64").toString("utf8")
    : decodeURIComponent(encoded);
  const session = JSON.parse(decoded) as { access_token?: string };
  if (!session.access_token) throw new Error("Hosted test session is unavailable for cleanup.");
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8")) as { sub?: string };
  if (!claims.sub) throw new Error("Hosted test identity is unavailable for cleanup.");
  return { accessToken: session.access_token, userId: claims.sub };
}

async function assertCourseRlsIsolation(courseId: string, userId: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      const owned = await client.query("select id from public.courses where id = $1", [courseId]);
      expect(owned.rowCount).toBe(1);
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", ["00000000-0000-4000-8000-000000000099"]);
      const hidden = await client.query("select id from public.courses where id = $1", [courseId]);
      expect(hidden.rowCount).toBe(0);
      await client.query("rollback");
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function cleanupCourse(courseId: string | undefined, cookies: Array<{ name: string; value: string }>) {
  if (!courseId || !process.env.DATABASE_URL) return;
  const { accessToken, userId } = sessionFromCookies(cookies);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const objects = await pool.query<{ storage_path: string }>(
      "select storage_path from public.course_materials where course_id = $1 and user_id = $2 and storage_path is not null",
      [courseId, userId],
    );
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      accessToken: async () => accessToken,
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
    });
    if (objects.rows.length) {
      const { error } = await supabase.storage.from("course-materials").remove(objects.rows.map((row) => row.storage_path));
      if (error) throw new Error("Hosted test PDF cleanup failed through the Storage API.");
    }
    await pool.query("delete from auth.users where id = $1", [userId]);
  } catch (error) {
    throw error;
  } finally {
    await pool.end();
  }
}

test("a student can add notes and PDFs and inspect source-backed concepts", async ({ page }, testInfo) => {
  test.skip(true, "Legacy hosted journey depends on anonymous sign-in; replace with a permanent-user fixture before re-enabling.");
  test.skip(!enabled, "Set RUN_HOSTED_SUPABASE_TESTS=1 to create one hosted anonymous test identity.");
  test.skip(testInfo.project.name !== "chromium", "Run hosted material processing once to avoid duplicate test identities.");
  test.skip(!process.env.DATABASE_URL, "Requires DATABASE_URL for narrowly scoped test cleanup.");
  test.setTimeout(180_000);
  let courseId: string | undefined;
  let cleanupCookies: Array<{ name: string; value: string }> = [];
  try {
    await page.goto("/onboarding");
    await page.getByLabel("What are you studying?").selectOption("Computer Science");
    await page.getByLabel("What level are you currently in?").selectOption("200 Level");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/home/, { timeout: 20_000 });
    // Preserve the synthetic owner's session before long worker waits can time out and close the context.
    cleanupCookies = await page.context().cookies();
    await page.getByRole("link", { name: "Open Courses" }).click();
    await expect(page).toHaveURL(/courses$/);
    await page.getByLabel("Course name").fill("Synthetic Data Structures");
    await page.getByLabel("Course code").fill("TEST-203");
    await page.getByRole("button", { name: "Create course" }).click();
    await expect(page).toHaveURL(/\/courses\/[0-9a-f-]+$/i);
    courseId = page.url().split("/").at(-1);
    if (!courseId) throw new Error("Course creation did not produce a course URL.");

    const notesCard = page.locator(".material-forms .content-card").nth(0);
    await notesCard.getByLabel("Material title").fill("Synthetic BST notes");
    await notesCard.getByLabel("Notes").fill("A binary search tree stores smaller keys in the left subtree and larger keys in the right subtree. Search compares a key and follows one branch. A balanced tree has logarithmic search time; a skewed tree can have linear search time.");
    await notesCard.getByRole("button", { name: "Save notes" }).click();
    const notes = page.locator(".material-card").filter({ hasText: "Synthetic BST notes" });
    await expect(notes.locator(".status-ready")).toBeVisible({ timeout: 90_000 });
    await expect(notes.locator(".concept-card").first()).toBeVisible();
    await expect(notes.locator(".source-label").first()).toContainText("p. 1");

    const pdfCard = page.locator(".material-forms .content-card").nth(1);
    await pdfCard.getByLabel("Material title").fill("Rejected text file");
    await pdfCard.getByLabel("Choose PDF").setInputFiles({ name: "not-a-pdf.txt", mimeType: "text/plain", buffer: Buffer.from("not a PDF") });
    await expect(pdfCard.getByRole("alert")).toContainText("Choose a PDF file");
    await expect(page.locator(".material-card").filter({ hasText: "Rejected text file" })).toHaveCount(0);

    await pdfCard.getByLabel("Material title").fill("Rejected oversized PDF");
    await pdfCard.getByLabel("Choose PDF").setInputFiles({
      name: "too-many-pages.pdf", mimeType: "application/pdf", buffer: syntheticPdf("Synthetic page content", 121),
    });
    await pdfCard.getByRole("button", { name: "Upload PDF" }).click();
    await expect(pdfCard.getByRole("alert")).toContainText("more than the supported 120 pages");
    await expect(page.locator(".material-card").filter({ hasText: "Rejected oversized PDF" })).toHaveCount(0);

    await pdfCard.getByLabel("Material title").fill("Synthetic PDF trees");
    await pdfCard.getByLabel("Choose PDF").setInputFiles({
      name: "synthetic-trees.pdf",
      mimeType: "application/pdf",
      buffer: syntheticPdf("A binary search tree stores smaller keys in its left subtree and larger keys in its right subtree. Search follows a branch after each comparison. Balanced search is logarithmic; skewed search may be linear."),
    });
    await pdfCard.getByRole("button", { name: "Upload PDF" }).click();
    const pdf = page.locator(".material-card").filter({ hasText: "Synthetic PDF trees" });
    await expect(pdf.locator(".status-ready")).toBeVisible({ timeout: 90_000 });
    await expect(pdf.locator(".concept-card").first()).toBeVisible();
    await expect(pdf.locator(".source-label").first()).toContainText("p. 1");

    const failedTitle = "Synthetic unreadable PDF";
    await pdfCard.getByLabel("Material title").fill(failedTitle);
    await pdfCard.getByLabel("Choose PDF").setInputFiles({
      name: "synthetic-unreadable.pdf", mimeType: "application/pdf", buffer: syntheticPdf("x"),
    });
    await pdfCard.getByRole("button", { name: "Upload PDF" }).click();
    const failedPdf = page.locator(".material-card").filter({ hasText: failedTitle });
    await expect(failedPdf.locator(".status-failed")).toBeVisible({ timeout: 90_000 });
    await failedPdf.getByRole("button", { name: "Remove failed material" }).click();
    await expect(page.locator(".material-card").filter({ hasText: failedTitle })).toHaveCount(0);
    await expect(page.locator(".material-card").filter({ hasText: "Synthetic PDF trees" })).toContainText("Source:");
    await expect(page.locator(".material-card").filter({ hasText: "Synthetic BST notes" })).toContainText("Source:");

    const { userId } = sessionFromCookies(await page.context().cookies());
    await assertCourseRlsIsolation(courseId, userId);

    await page.setViewportSize({ width: 390, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  } finally {
    await cleanupCourse(courseId, cleanupCookies);
  }
});
