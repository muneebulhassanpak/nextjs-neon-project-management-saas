import { expect, test, type Locator, type Page } from "@playwright/test";

import { signUpAndSignIn, uniqueEmail } from "./helpers/auth";

/** Drags a card with the mouse, in small steps so dnd-kit sees a real drag. */
async function drag(page: Page, card: Locator, target: Locator) {
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Card or target isn't visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 8, from.y + from.height / 2 + 8, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 10, { steps: 15 });
  await page.mouse.up();
  // dnd-kit swallows clicks for 50ms after a drop, so a fast click right after would be lost.
  await page.waitForTimeout(100);
}

const titlesIn = (page: Page, column: string) =>
  page.getByRole("region", { name: column }).locator("[data-task-card] p");

test("an owner plans work on a board, and the order survives a reload", async ({ page }) => {
  await page.goto("/sign-up");
  await signUpAndSignIn(page, "Bea Board", uniqueEmail("board"));
  await page.getByLabel("Organization name").fill("Board Co");
  await page.getByLabel("URL").fill(`board-${Date.now()}`);
  await page.getByRole("button", { name: "Create organization" }).click();

  await page.getByRole("link", { name: "Projects" }).first().click();
  await page.getByRole("button", { name: "New project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Website redesign");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Website redesign" })).toBeVisible();

  const todo = page.getByRole("region", { name: "To do" });
  await todo.getByRole("button", { name: "Add task" }).click();
  for (const title of ["Write copy", "Pick fonts", "Collect logos"]) {
    await todo.getByLabel("New task title").fill(title);
    await todo.getByLabel("New task title").press("Enter");
    await expect(titlesIn(page, "To do").last()).toHaveText(title);
  }
  await todo.getByLabel("New task title").press("Escape");

  // Reorder within a column, then move a card to another column.
  await drag(
    page,
    todo.getByRole("button", { name: /^Collect logos/ }),
    titlesIn(page, "To do").first(),
  );
  await expect(titlesIn(page, "To do")).toHaveText(["Collect logos", "Write copy", "Pick fonts"]);
  await drag(
    page,
    todo.getByRole("button", { name: /^Pick fonts/ }),
    page.getByRole("region", { name: "Review" }),
  );
  await expect(titlesIn(page, "Review")).toHaveText(["Pick fonts"]);

  // Open a task and change it.
  await page.getByRole("button", { name: /^Write copy/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("combobox", { name: "Priority" }).click();
  await page.getByRole("option", { name: "Urgent" }).click();
  await expect(sheet.getByRole("combobox", { name: "Priority" })).toHaveText("Urgent");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("img", { name: "Urgent priority" })).toBeVisible();

  await page.reload();
  await expect(titlesIn(page, "To do")).toHaveText(["Collect logos", "Write copy"]);
  await expect(titlesIn(page, "Review")).toHaveText(["Pick fonts"]);
  await expect(page.getByRole("img", { name: "Urgent priority" })).toBeVisible();
});
