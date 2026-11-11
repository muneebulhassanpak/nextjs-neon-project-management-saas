import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Stackboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
