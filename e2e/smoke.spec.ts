import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Stackboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the landing page leads to sign-up and sign-in", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Start for free" }).first().click();
  await expect(page).toHaveURL(/\/sign-up$/);

  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the mobile menu links to the page sections and to sign-up", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/#pricing");
  await menu.getByRole("link", { name: "Get started for free" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("theme can be switched", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitem", { name: "Light" }).click();

  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("health check reports ok with a request ID", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-request-id"]).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});
