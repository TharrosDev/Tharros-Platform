import { expect, test } from "@playwright/test";

test("sharing images and the Apple icon are public image responses", async ({ page }) => {
  await page.goto("/");
  for (const [selector, attribute] of [
    ['meta[property="og:image"]', "content"],
    ['link[rel="apple-touch-icon"]', "href"],
  ]) {
    const value = await page.locator(selector).getAttribute(attribute);
    expect(value).toBeTruthy();
    const asset = new URL(value!, page.url());
    const response = await page.request.get(asset.pathname + asset.search);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("campaign destinations are public and point to their own canonical URL", async ({ page }) => {
  for (const path of [
    "/",
    "/products",
    "/products/business-assistant",
    "/products/workforce-scheduling",
    "/products/lead-capture",
    "/products/automations",
    "/solutions",
    "/how-it-works",
    "/pricing",
    "/contact",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page.locator("h1")).toBeVisible();
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname).toBe(path);
  }
});

test("visitors can explore all four examples using the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Team handbook/ }).click();
  await expect(page.locator("#demo-source")).toBeVisible();
  await page.getByRole("tab", { name: "Knowledge", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Scheduling", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Review draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("No schedule was published");
  await page.getByRole("tab", { name: "Leads", exact: true }).click();
  await page.getByRole("button", { name: "See a follow-up draft" }).click();
  await expect(page.getByText("Draft only · review before sending")).toBeVisible();
  await page.getByRole("tab", { name: "Automation", exact: true }).click();
  await page.getByRole("button", { name: "Try the example" }).click();
  await expect(page.getByRole("status")).toContainText("Example complete");
});

test("mobile visitors can reach every main destination without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menu.getByRole("link", { name: "Platform", exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Contact", exact: true })).toBeVisible();
  await menu.getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  for (const path of [
    "/",
    "/pricing",
    "/solutions",
    "/products/workforce-scheduling",
    "/contact",
  ]) {
    await page.goto(path);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
});
