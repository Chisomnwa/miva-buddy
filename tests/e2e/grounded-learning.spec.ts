import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { loadEnvConfig } from "@next/env";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getServerConfig } from "@/lib/config";
import { FakeEmbeddingProvider } from "@/server/embeddings/providers/fake";
import { OllamaEmbeddingProvider } from "@/server/embeddings/providers/ollama";

loadEnvConfig(process.cwd());
const enabled = process.env.RUN_HOSTED_SUPABASE_TESTS === "1";
const remoteOkPilotEnabled = process.env.REMOTEOK_METADATA_PILOT === "true";
const himalayasMetadataEnabled = process.env.HIMALAYAS_METADATA_ENABLED === "true";
const syntheticPassage = "A binary search tree stores values smaller than a node in its left subtree and values larger than a node in its right subtree. This synthetic lecture also names SQL as a query language.";
const question = "According to my course notes, where are values smaller than a node stored?";

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
  return { userId: claims.sub };
}

async function seedReadyCourse(userId: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const courseId = randomUUID();
  const materialId = randomUUID();
  const conceptId = randomUUID();
  const chunkId = randomUUID();
  try {
    const config = getServerConfig();
    const embeddingProvider = config.EMBEDDING_PROVIDER === "fake"
      ? new FakeEmbeddingProvider()
      : new OllamaEmbeddingProvider(config.OLLAMA_BASE_URL, config.OLLAMA_EMBEDDING_MODEL);
    const [vector] = await embeddingProvider.embed({
      texts: [syntheticPassage], signal: AbortSignal.timeout(20_000),
    });
    if (!vector || vector.length !== 768) throw new Error("Synthetic fixture embedding failed its dimension check.");
    const vectorLiteral = `[${vector.join(",")}]`;

    await pool.query("begin");
    await pool.query(
      "insert into public.courses (id,user_id,title,course_code) values ($1,$2,$3,$4)",
      [courseId, userId, "Synthetic Grounded Learn", "TEST-M4"],
    );
    await pool.query(
      `insert into public.course_materials (id,user_id,course_id,title,kind,status,processing_attempts)
       values ($1,$2,$3,$4,'notes','ready',1)`,
      [materialId, userId, courseId, "Synthetic BST Notes"],
    );
    await pool.query(
      `insert into public.material_pages (user_id,course_id,material_id,page_number,content)
       values ($1,$2,$3,1,$4)`,
      [userId, courseId, materialId, syntheticPassage],
    );
    await pool.query(
      `insert into public.material_chunks
        (id,user_id,course_id,material_id,ordinal,page_start,page_end,content,embedding,embedding_model)
       values ($1,$2,$3,$4,0,1,1,$5,$6::extensions.vector,$7)`,
      [chunkId, userId, courseId, materialId, syntheticPassage, vectorLiteral, "fake-v1"],
    );
    await pool.query(
      `insert into public.course_concepts
        (id,user_id,course_id,material_id,title,description,ordinal,extraction_version)
       values ($1,$2,$3,$4,$5,$6,0,'synthetic-e2e-v1')`,
      [conceptId, userId, courseId, materialId, "Binary Search Tree Structure", "Smaller and larger values are organized around each node."],
    );
    await pool.query(
      `insert into public.course_concept_sources (user_id,material_id,concept_id,chunk_id)
       values ($1,$2,$3,$4)`,
      [userId, materialId, conceptId, chunkId],
    );
    await pool.query("commit");
    return { pool, courseId, materialId, conceptId, chunkId };
  } catch (error) {
    await pool.query("rollback").catch(() => {});
    await pool.end();
    throw error;
  }
}

async function assertOtherUserCannotReadGroundedData(
  pool: Pool, input: { courseId: string; conversationId: string; chunkId: string },
) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", ["00000000-0000-4000-8000-000000000099"]);
    const conversation = await client.query("select id from public.learn_conversations where id=$1", [input.conversationId]);
    const source = await client.query("select id from public.material_chunks where id=$1", [input.chunkId]);
    const retrieval = await client.query(
      `select count(*)::int as count from public.search_course_material_chunks(
        $1,'binary search tree smaller values',array_fill(0.01::real,array[768])::extensions.vector(768),null,null,8)`,
      [input.courseId],
    );
    expect(conversation.rowCount).toBe(0);
    expect(source.rowCount).toBe(0);
    expect(retrieval.rows[0].count).toBe(0);
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

test("a grounded Learn answer cites and opens its owned source, then restores the conversation", async ({ page }, testInfo) => {
  test.skip(!enabled, "Set RUN_HOSTED_SUPABASE_TESTS=1 to seed a hosted synthetic course fixture.");
  test.skip(testInfo.project.name !== "chromium", "Run hosted Auth integration once to avoid duplicate test identities.");
  test.skip(!process.env.DATABASE_URL, "Requires DATABASE_URL for synthetic fixture setup and cleanup.");
  test.setTimeout(120_000);
  let pool: Pool | undefined;
  let userId: string | undefined;
  try {
    await page.addInitScript(`
      (() => {
        class MockSpeechRecognition {
          onstart = null; onresult = null; onend = null; onerror = null;
          start() { this.onstart?.(); }
          stop() {
            this.onresult?.({ results: [{ isFinal: true, 0: { transcript: "spoken course follow-up" } }] });
            this.onend?.();
          }
          abort() {}
        }
        window.SpeechRecognition = MockSpeechRecognition;
      })();
    `);
    await page.goto("/onboarding");
    await page.getByLabel("What are you studying?").selectOption("Computer Science");
    await page.getByLabel("What level are you currently in?").selectOption("200 Level");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/home/, { timeout: 20_000 });
    userId = sessionFromCookies(await page.context().cookies()).userId;
    const fixture = await seedReadyCourse(userId);
    pool = fixture.pool;

    await page.goto(`/learn/course/${fixture.courseId}/${fixture.conceptId}`);
    await expect(page.getByRole("heading", { name: "Binary Search Tree Structure" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const composer = page.getByLabel("Ask about this concept");
    await composer.fill("Keep this typed draft");
    await page.getByRole("button", { name: "Start voice input" }).click();
    await expect(page.getByRole("button", { name: "Stop voice input" })).toBeVisible();
    await page.getByRole("button", { name: "Stop voice input" }).click();
    await expect(composer).toHaveValue("Keep this typed draft spoken course follow-up");
    await expect(page.getByText("Transcription added. Review or edit it before sending.")).toBeVisible();
    await expect(page).not.toHaveURL(/conversationId=/);
    await composer.fill(question);
    await expect(composer).toHaveValue(question);
    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(page).toHaveURL(/conversationId=[0-9a-f-]+/i, { timeout: 60_000 });
    await expect(page.getByText("From your course material", { exact: true })).toBeVisible({ timeout: 60_000 });
    const industryPreview = page.locator(".industry-evidence-demo");
    await expect(industryPreview.getByText("DEMONSTRATION ONLY — NOT A REAL JOB POSTING")).toBeVisible();
    await expect(industryPreview).toContainText("Course text directly mentions SQL");
    await expect(industryPreview).toContainText("Example organization (synthetic)");
    await expect(industryPreview.getByRole("link")).toHaveCount(0);
    if (himalayasMetadataEnabled) {
      const listingHeading = page.getByText("HIMALAYAS · RELATED LISTINGS", { exact: true });
      const searchStatus = page.getByRole("status").filter({ hasText: "Himalayas" });
      await expect.poll(async () => (await listingHeading.count()) + (await searchStatus.count())).toBeGreaterThan(0);
      if (await listingHeading.count()) {
        const evidence = page.locator(".remoteok-evidence").filter({ hasText: "HIMALAYAS · RELATED LISTINGS" });
        await expect(evidence).toContainText("Descriptions were not checked");
        const card = evidence.locator(".remoteok-card").first();
        await expect(card.locator("h3")).not.toBeEmpty();
        await expect(card.locator(".remoteok-company")).not.toBeEmpty();
        await expect(card).toContainText("Source: Himalayas");
        await expect(card).toContainText("Retrieved");
        await expect(card.getByRole("link", { name: /View listing on Himalayas/ }))
          .toHaveAttribute("href", /^https:\/\/himalayas\.app\/jobs\//);
      } else {
        await expect(searchStatus).toBeVisible();
      }
    }
    if (remoteOkPilotEnabled) {
      const remoteOk = page.locator(".remoteok-evidence");
      const remoteOkStatus = page.getByRole("status").filter({ hasText: /Remote OK/ });
      await expect.poll(async () => (await remoteOk.count()) > 0 || (await remoteOkStatus.count()) > 0).toBe(true);
      if (await remoteOk.count()) {
        await expect(remoteOk.getByText("REMOTE OK · METADATA ONLY")).toBeVisible();
        await expect(remoteOk.getByText("Job descriptions were not checked, so no skill requirement is being claimed.")).toBeVisible();
        await expect(remoteOk.getByRole("link", { name: /View original listing on Remote OK/ }).first())
          .toHaveAttribute("href", /^https:\/\/remoteok\.com\/remote-jobs\//);
      } else {
        await expect(remoteOkStatus).toBeVisible();
      }
    }
    const conversationId = new URL(page.url()).searchParams.get("conversationId");
    if (!conversationId) throw new Error("Grounded conversation did not persist its context.");

    await assertOtherUserCannotReadGroundedData(pool, { courseId: fixture.courseId, conversationId, chunkId: fixture.chunkId });
    const groundedUrl = page.url();
    await page.reload();
    await expect(page).toHaveURL(groundedUrl);
    await expect(page.getByText("From your course material", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(industryPreview).toHaveCount(0);
    const inspect = page.getByRole("button", { name: "Inspect source" }).first();
    await inspect.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Synthetic BST Notes");
    await expect(dialog).toContainText("Synthetic Grounded Learn");
    await expect(dialog).toContainText("Page 1");
    await expect(dialog).toContainText("smaller than a node in its left subtree");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Return to learning" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(inspect).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  } finally {
    if (userId && process.env.DATABASE_URL) {
      const cleanupPool = pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      await cleanupPool.query("delete from auth.users where id=$1", [userId]);
      await cleanupPool.end();
    }
  }
});
