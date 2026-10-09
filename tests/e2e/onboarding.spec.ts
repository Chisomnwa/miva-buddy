import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const runHostedSupabaseTests = process.env.RUN_HOSTED_SUPABASE_TESTS === "1";

test("unconfigured instance explains the required setup", async ({ page }) => {
  test.skip(configured, "A configured project opens directly to onboarding.");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Connect your Supabase project" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("first visit opens onboarding without an authentication ceremony", async ({ page }) => {
  test.skip(!configured, "Requires a configured Supabase project.");
  await page.goto("/");
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByRole("heading", { name: "Welcome to your study space" })).toBeVisible();
  await expect(page.locator(".onboarding-card .brand-symbol")).toBeVisible();
  await expect(page.getByLabel(/email|password|sign in|sign up/i)).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("onboarding photo is local and the form remains readable on desktop and mobile", async ({ page, request }) => {
  test.skip(!configured, "Requires a configured Supabase project.");
  const image = await request.get("/images/onboarding-study.webp");
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/webp");

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Welcome to your study space" })).toBeVisible();
    await expect(page.getByLabel("What are you studying?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    const background = await page.locator(".onboarding-screen").evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(background).toContain("/images/onboarding-study.webp");
    expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("onboarding falls back to a readable surface if the photograph cannot load", async ({ page }) => {
  test.skip(!configured, "Requires a configured Supabase project.");
  await page.route("**/images/onboarding-study.webp", (route) => route.abort());
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to your study space" })).toBeVisible();
  await expect(page.getByLabel("What are you studying?")).toBeVisible();
  const color = await page.locator(".onboarding-screen").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(color).not.toBe("rgba(0, 0, 0, 0)");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("the favicon uses the supplied Miva symbol asset", async ({ request }) => {
  const asset = await request.get("/brand/miva-logo.png");
  expect(asset.ok()).toBe(true);
  const icon = await request.get("/icon");
  expect(icon.ok()).toBe(true);
  expect(icon.headers()["content-type"]).toContain("image/png");
  const bytes = await icon.body();
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});

test("profile submission creates a browser identity, persists, and remains isolated", async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!configured, "Requires a configured Supabase project.");
  test.skip(!runHostedSupabaseTests, "Set RUN_HOSTED_SUPABASE_TESTS=1 to run hosted Auth integration checks; anonymous test users count against Supabase Auth rate limits.");
  test.skip(testInfo.project.name !== "chromium", "Run hosted Auth integration once to avoid creating duplicate anonymous users.");
  await page.addInitScript(`
    (() => {
      class MockSpeechRecognition {
        constructor() { window.__mockSpeechRecognition = this; }
        start() { this.onstart?.(); }
        stop() {
          this.onresult?.({ results: [{ isFinal: true, 0: { transcript: "Add one spoken follow-up." } }] });
          this.onend?.();
        }
        abort() { window.__mockSpeechAbortCount = (window.__mockSpeechAbortCount || 0) + 1; }
      }
      window.SpeechRecognition = MockSpeechRecognition;
    })();
  `);
  await page.goto("/onboarding");
  await page.getByLabel("What are you studying?").selectOption("Computer Science");
  await page.getByLabel("What level are you currently in?").selectOption("200 Level");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/home/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "What would you like to learn today?" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Primary navigation must remain reachable in keyboard focus order.
  let learnFocused = false;
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.getAttribute("href") === "/learn")) {
      learnFocused = true;
      break;
    }
  }
  expect(learnFocused).toBe(true);

  await expect(page.locator("a.nav-link[href='/home']:visible")).toHaveAttribute("aria-current", "page");
  await expect(page.locator("a.nav-link[href='/learn']:visible")).toBeVisible();
  await expect(page.locator("a.nav-link[href='/courses']:visible")).toBeVisible();
  await expect(page.locator("a.nav-link[href='/practice']:visible")).toBeVisible();
  await expect(page.locator("a[href='/profile']:visible").first()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/home/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "What would you like to learn today?" })).toBeVisible();
  await page.locator("a[href='/profile']:visible").first().click();
  await expect(page).toHaveURL(/profile/);
  await expect(page.getByLabel("What level are you currently in?")).toHaveValue("200 Level");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByLabel("What are you studying?").selectOption("Software Engineering");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/profile/);
  await expect(page.getByRole("status")).toContainText("Profile changes saved.");
  await expect(page.getByLabel("What are you studying?")).toHaveValue("Software Engineering");

  await page.locator("a.nav-link[href='/learn']:visible").first().click();
  await expect(page).toHaveURL(/learn$/);
  await expect(page.getByText("General explanation", { exact: true })).toBeVisible();
  await expect(page.getByText(/No course material is attached/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Ask a question").fill("Explain binary trees with a small example.");
  expect(await page.evaluate("typeof window.SpeechRecognition")).toBe("function");
  await expect(page.getByRole("button", { name: "Start voice input" })).toBeEnabled();
  await expect(page.getByText(/may use your browser vendor’s speech service/)).toBeVisible();
  await page.getByRole("button", { name: "Start voice input" }).click();
  await expect(page.getByRole("button", { name: "Stop voice input" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Stop voice input" }).click();
  await expect(page.getByLabel("Ask a question")).toHaveValue("Explain binary trees with a small example. Add one spoken follow-up.");
  await expect(page.getByText("Transcription added. Review or edit it before sending.")).toBeVisible();
  await expect(page).toHaveURL(/learn$/);
  await page.getByLabel("Ask a question").fill("Explain binary trees with a small example.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/\/learn\/[0-9a-f-]+$/i, { timeout: 20_000 });
  await expect(page.locator(".learn-message-student .learn-message-content").filter({ hasText: /^Explain binary trees with a small example\.$/ })).toBeVisible();
  await expect(page.getByText(/Let’s unpack Explain binary trees/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy response" })).toBeVisible();
  const conversationUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(conversationUrl);
  await expect(page.locator(".learn-message-student .learn-message-content").filter({ hasText: /^Explain binary trees with a small example\.$/ })).toBeVisible();
  await page.locator("a.nav-link[href='/home']:visible").first().click();
  await expect(page.getByRole("heading", { name: "Recent learning" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Explain binary trees with a small example/ })).toBeVisible();

  await page.locator("a.nav-link[href='/learn']:visible").first().click();
  await expect(page).toHaveURL(/learn$/);
  await page.getByLabel("Ask a question").fill("Help me prepare for an interview for a backend engineering internship.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/\/learn\/[0-9a-f-]+$/i, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "A quick clarification" })).toBeVisible();
  await expect(page.getByText(/Which company is the interview with/)).toBeVisible();
  await page.getByLabel("Ask a question").fill("Coinbase");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "General interview preparation—not company-specific" })).toBeVisible();
  await expect(page.getByText("Company:").locator(".." )).toContainText("Coinbase");
  await expect(page.getByText(/Company-specific candidate accounts are not available in this version; no external source was queried/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Topics to review" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "General mock prompts—not company questions" })).toBeVisible();
  const hackerNewsSearch = page.getByRole("link", { name: "Search Hacker News discussions (external)" });
  const leetCodeSearch = page.getByRole("link", { name: "Search LeetCode Discuss (external)" });
  await expect(hackerNewsSearch).toHaveAttribute("target", "_blank");
  await expect(hackerNewsSearch).toHaveAttribute("rel", "noopener noreferrer");
  await expect(leetCodeSearch).toHaveAttribute("target", "_blank");
  await expect(leetCodeSearch).toHaveAttribute("rel", "noopener noreferrer");
  const hnQuery = new URL(await hackerNewsSearch.getAttribute("href") ?? "").searchParams.get("q");
  const leetCodeQuery = new URL(await leetCodeSearch.getAttribute("href") ?? "").searchParams.get("q");
  expect(hnQuery).toContain("site:news.ycombinator.com/item");
  expect(hnQuery).toContain("Coinbase");
  expect(hnQuery).toContain("backend engineering internship");
  expect(leetCodeQuery).toContain("site:leetcode.com/discuss");
  expect(leetCodeQuery).toContain("Coinbase");
  expect(leetCodeQuery).toContain("backend engineering internship");
  await expect(page.getByText(/Miva Buddy does not fetch or review the results/)).toBeVisible();
  await expect(page.getByText(/Coinbase.{0,40}(?:uses|asks|has|includes)/i)).toHaveCount(0);
  const interviewConversationUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(interviewConversationUrl);
  await expect(page.getByRole("heading", { name: "General interview preparation—not company-specific" })).toBeVisible();
  await expect(page.getByText("Company:").locator(".." )).toContainText("Coinbase");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(hackerNewsSearch).toBeVisible();
  await expect(leetCodeSearch).toBeVisible();
  expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const longProse = "A clear explanation should wrap within the phone screen without hiding the composer. ".repeat(10);
  const longCodeLine = `const unusuallyLongIdentifierWithoutBreaks${"x".repeat(100)} = 42;`;
  const mobilePrompt = [
    "Please explain this code and long example.",
    "",
    longProse,
    "",
    "```js",
    longCodeLine,
    "```",
  ].join("\n");
  await page.locator("a.nav-link[href='/learn']:visible").first().click();
  await expect(page).toHaveURL(/learn$/);
  const composer = page.getByLabel("Ask a question");
  await composer.fill(mobilePrompt);
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeVisible();
  await send.click();
  await expect(page).toHaveURL(/\/learn\/[0-9a-f-]+$/i, { timeout: 20_000 });
  const mobileQuestion = page.locator(".learn-message-student").last();
  await expect(mobileQuestion.locator("pre.learn-code-block code")).toContainText("unusuallyLongIdentifierWithoutBreaks");
  await expect(composer).toHaveValue("");
  const mobileLayout = await page.evaluate(() => {
    const code = document.querySelector(".learn-code-block");
    const transcript = document.querySelector(".learn-transcript");
    const textarea = document.querySelector("#learn-message");
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      codeWidth: code?.clientWidth ?? 0,
      codeScrollWidth: code?.scrollWidth ?? 0,
      transcriptWidth: transcript?.clientWidth ?? 0,
      composerRight: textarea?.getBoundingClientRect().right ?? Infinity,
    };
  });
  expect(mobileLayout.pageWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth);
  expect(mobileLayout.composerRight).toBeLessThanOrEqual(mobileLayout.viewportWidth);
  expect(mobileLayout.codeWidth).toBeLessThanOrEqual(mobileLayout.transcriptWidth);
  expect(mobileLayout.codeScrollWidth).toBeGreaterThan(mobileLayout.codeWidth);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const separateBrowser = await browser.newContext();
  const otherStudent = await separateBrowser.newPage();
  await otherStudent.goto("/home");
  await expect(otherStudent).toHaveURL(/onboarding/);
  await expect(otherStudent.getByLabel("What level are you currently in?")).toHaveValue("100 Level");
  await separateBrowser.close();

  await page.locator("a.nav-link[href='/learn']:visible").first().click();
  await expect(page).toHaveURL(/learn$/);
  await page.getByRole("button", { name: "Start voice input" }).click();
  await page.evaluate("window.__mockSpeechRecognition.onerror({ error: 'not-allowed' })");
  await expect(page.getByRole("status")).toContainText("Microphone access was denied");
  await page.getByRole("button", { name: "Start voice input" }).click();
  await page.locator("a.nav-link[href='/home']:visible").first().click();
  await expect.poll(() => page.evaluate("window.__mockSpeechAbortCount || 0")).toBe(1);
  await page.evaluate("delete window.SpeechRecognition; delete window.webkitSpeechRecognition");
  await page.goto("/learn");
  await expect(page.getByRole("button", { name: "Voice input unavailable" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("not supported by this browser");
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390);
});

test("onboarding remains usable on a narrow viewport", async ({ page }) => {
  test.skip(!configured, "Requires a configured Supabase project.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/onboarding");
  await expect(page.getByLabel("What are you studying?")).toBeVisible();
  const pageWidth = await page.locator("body").evaluate((element) => element.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(390);
});

test("onboarding remains usable at tablet width", async ({ page }) => {
  test.skip(!configured, "Requires a configured Supabase project.");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Welcome to your study space" })).toBeVisible();
  const pageWidth = await page.locator("body").evaluate((element) => element.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(768);
});
