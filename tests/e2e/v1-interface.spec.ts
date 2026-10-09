import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const enabled = process.env.RUN_HOSTED_SUPABASE_TESTS === "1";

function testIdentity(cookies: Array<{ name: string; value: string }>) {
  const authCookies = cookies.filter((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const encoded = authCookies.map((cookie) => cookie.value).join("");
  const decoded = encoded.startsWith("base64-") ? Buffer.from(encoded.slice(7), "base64").toString("utf8") : decodeURIComponent(encoded);
  const session = JSON.parse(decoded) as { access_token?: string };
  if (!session.access_token) throw new Error("Hosted test identity is unavailable.");
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8")) as { sub?: string };
  if (!claims.sub) throw new Error("Hosted test identity is unavailable.");
  return claims.sub;
}

test("V1 student navigation and resume labels reflect owned state", async ({ page }, testInfo) => {
  test.skip(!enabled, "Hosted synthetic UI journey is opt-in to protect Auth rate limits.");
  test.skip(testInfo.project.name !== "chromium", "Run hosted identity creation once.");
  test.skip(!process.env.DATABASE_URL, "Requires exact test-identity cleanup.");
  test.setTimeout(120_000);
  let ownerId: string | undefined;
  try {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/home/);
    ownerId = testIdentity(await page.context().cookies());

    await expect(page.locator(".sidebar .brand-symbol")).toBeVisible();
    await expect(page.locator("a.nav-link[href='/courses']:visible")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your courses" })).toHaveCount(0);
    await page.getByRole("link", { name: "Open Courses" }).click();
    await expect(page).toHaveURL(/\/courses$/);
    await page.getByLabel("Course name").fill("Synthetic V1 Interface Course");
    await page.getByLabel("Course code").fill("UI-TEST");
    await page.getByRole("button", { name: "Create course" }).click();
    await expect(page.getByRole("heading", { name: "Synthetic V1 Interface Course" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add material" })).toBeVisible();
    await expect(page.getByLabel("Choose PDF")).toBeVisible();
    await page.getByRole("link", { name: "All courses" }).click();
    await expect(page.getByRole("link", { name: /Synthetic V1 Interface Course/ })).toBeVisible();

    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Your courses" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Synthetic V1 Interface Course/ })).toBeVisible();
    await page.goto("/learn");
    await expect(page.getByRole("link", { name: "Browse Courses" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Explain recursion with a small example" })).toBeVisible();
    await expect(page.getByText("General explanation", { exact: true })).toBeVisible();

    const conversationId = randomUUID();
    const syntheticAnswer = "A safe example:\n```js\nconst answer = 42;\n```";
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      await pool.query("insert into public.learn_conversations (id,user_id,title) values ($1,$2,$3)",
        [conversationId, ownerId, "Synthetic V1 copy check"]);
      await pool.query("insert into public.learn_messages (id,conversation_id,user_id,role,content) values ($1,$2,$3,'assistant',$4)",
        [randomUUID(), conversationId, ownerId, syntheticAnswer]);
    } finally { await pool.end(); }
    await page.goto(`/learn/${conversationId}`);
    await expect(page.getByLabel("Code example")).toContainText("const answer = 42;");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
    await expect(page.getByRole("button", { name: "Copy response" })).toBeEnabled();
    await page.getByRole("button", { name: "Copy response" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(syntheticAnswer);

    await page.goto("/practice/topic/arrays-hashing");
    await expect(page.getByRole("button", { name: "Start practice" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Start practice" }).first().click();
    await expect(page.getByRole("heading", { name: "Two Sum" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Assistance mode" })).toHaveValue("coach");
    await expect(page.getByText("Add your attempt or context")).toBeVisible();
    await page.locator("details.practice-context summary").click();
    await page.getByLabel(/Your attempt or relevant context/).fill("Synthetic attempt context");
    await expect(page.getByLabel(/Your attempt or relevant context/)).toHaveValue("Synthetic attempt context");
    await page.goto("/practice/topic/arrays-hashing");
    await expect(page.getByRole("link", { name: "Resume practice" })).toBeVisible();
    await page.getByRole("link", { name: "Resume practice" }).click();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("Marked complete")).toBeVisible();
    await page.goto("/practice/topic/arrays-hashing");
    await expect(page.getByText(/Marked complete by you · LeetCode not verified/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start practice" }).first()).toBeVisible();

    await page.goto("/profile");
    await page.getByLabel("What level are you currently in?").selectOption("200 Level");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Profile changes saved.");
    await expect(page.getByLabel("What level are you currently in?")).toHaveValue("200 Level");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    await expect(page.locator(".bottom-nav a[href='/courses']")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  } finally {
    if (!ownerId) {
      const cookies = await page.context().cookies();
      if (cookies.some((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))) ownerId = testIdentity(cookies);
    }
    if (ownerId) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try { await pool.query("delete from auth.users where id=$1", [ownerId]); }
      finally { await pool.end(); }
    }
  }
});
