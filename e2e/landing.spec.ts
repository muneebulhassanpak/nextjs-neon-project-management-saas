import { expect, test } from "@playwright/test";

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("everything is shown at once, with the final numbers", async ({ page }) => {
    await page.goto("/");

    const hero = page.locator("[aria-hidden]").filter({ hasText: "Tracked this week" }).first();
    await expect(hero).toContainText("32h 10m");
    await expect(hero).toContainText("64%");

    // Nothing waits for a scroll to appear, and no loops run.
    await page.locator("#faq").scrollIntoViewIfNeeded();
    const hidden = await page
      .locator(".lp-reveal")
      .evaluateAll((elements) =>
        elements.filter((element) => getComputedStyle(element).opacity !== "1"),
      );
    expect(hidden).toHaveLength(0);
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSAnimation)
        .map((animation) => animation.animationName)
        .filter((name) => name.startsWith("lp-") && name !== "lp-header"),
    );
    expect(running).toEqual([]);
  });
});

test("the hero numbers count up to their values", async ({ page }) => {
  await page.goto("/");

  const hero = page.locator("[aria-hidden]").filter({ hasText: "Tracked this week" }).first();
  await expect(hero).toContainText("32h 10m");
  await expect(hero).toContainText("86");
});

test("the header highlights the section in view", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });

  await page.locator("#pricing").scrollIntoViewIfNeeded();
  await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute(
    "aria-current",
    "location",
  );
  await page.locator("#faq").scrollIntoViewIfNeeded();
  await expect(nav.getByRole("link", { name: "FAQ" })).toHaveAttribute("aria-current", "location");
  await expect(nav.getByRole("link", { name: "Pricing" })).not.toHaveAttribute("aria-current");
});
