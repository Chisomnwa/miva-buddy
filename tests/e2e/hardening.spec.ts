import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("unknown routes give a safe recovery path and app responses include baseline security headers", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn’t find that page." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Home" })).toHaveAttribute("href", "/home");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const headers = await response!.allHeaders();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the not-found recovery screen fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/this-page-does-not-exist");
  const widths = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(widths.page).toBeLessThanOrEqual(widths.viewport);
});
