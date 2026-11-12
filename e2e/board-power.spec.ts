import { expect, test, type Page } from "@playwright/test";

import { signUpAndSignIn, uniqueEmail } from "./helpers/auth";
import { addTask, createProject, ownerAndAdmin } from "./helpers/team";

const card = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`^${title}`) });
const titlesIn = (page: Page, column: string) =>
  page.getByRole("region", { name: column }).locator("[data-task-card] p");

test("checklists, bulk actions, undo and My work", async ({ page }) => {
  test.setTimeout(90_000);
  const slug = `power-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  await page.goto("/sign-up");
  await signUpAndSignIn(page, "Pat Power", uniqueEmail("power"));
  await page.getByLabel("Organization name").fill("Power Co");
  await page.getByLabel("URL").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}$`));
  await createProject(page, slug, "Launch");

  const todo = page.getByRole("region", { name: "To do" });
  await todo.getByRole("button", { name: "Add task" }).click();
  for (const title of ["Hero", "Pricing", "Footer"]) {
    await todo.getByLabel("New task title").fill(title);
    await todo.getByLabel("New task title").press("Enter");
    await expect(titlesIn(page, "To do").last()).toHaveText(title);
  }
  await todo.getByLabel("New task title").press("Escape");

  // A checklist, with progress on the card.
  await card(page, "Hero").click();
  const sheet = page.getByRole("dialog");
  for (const item of ["Wireframe", "Copy"]) {
    await sheet.getByLabel("New checklist item").fill(item);
    await sheet.getByLabel("New checklist item").press("Enter");
    await expect(sheet.getByRole("checkbox", { name: item })).toBeVisible();
  }
  await sheet.getByRole("checkbox", { name: "Wireframe" }).click();
  await expect(sheet.getByText("1 of 2 done")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card(page, "Hero")).toContainText("1/2");

  // Select two tasks (checkbox, then Shift-click) and move them together.
  await card(page, "Hero").hover();
  await page.getByRole("button", { name: "Select Hero" }).click();
  await card(page, "Footer").click({ modifiers: ["Shift"] });
  const bar = page.getByRole("toolbar", { name: "Actions for 2 selected tasks" });
  await bar.getByRole("button", { name: "Move" }).click();
  await page.getByRole("menuitem", { name: "Done" }).click();
  await expect(titlesIn(page, "Done")).toHaveText(["Hero", "Footer"]);
  await expect(bar).toBeHidden();

  // Assign them to me in one go; they show up in My work.
  await card(page, "Hero").click({ modifiers: ["Shift"] });
  await card(page, "Pricing").click({ modifiers: ["Shift"] });
  await bar.getByRole("button", { name: "Assign" }).click();
  await page.getByRole("menuitem", { name: "Pat Power" }).click();
  await expect(card(page, "Pricing")).toContainText("Assigned to Pat Power");
  await expect(bar).toBeHidden();

  // Delete, undo, then delete for real.
  await card(page, "Footer").click({ modifiers: ["Shift"] });
  await card(page, "Pricing").click({ modifiers: ["Shift"] });
  await page.getByRole("toolbar").getByRole("button", { name: "Delete" }).click();
  await expect(card(page, "Footer")).toBeHidden();
  await page
    .getByRole("listitem")
    .filter({ hasText: "Deleted 2 tasks" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(card(page, "Footer")).toBeVisible();
  await expect(card(page, "Pricing")).toBeVisible();

  await card(page, "Footer").click({ modifiers: ["Shift"] });
  await page.getByRole("toolbar").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted “Footer”")).toBeVisible();
  // Toasts pause while the pointer is over them; step away so this one runs out.
  await page.mouse.move(0, 0);
  await expect(page.getByText("Deleted “Footer”")).toBeHidden({ timeout: 10_000 });
  await page.reload();
  await expect(card(page, "Hero")).toBeVisible();
  await expect(card(page, "Footer")).toHaveCount(0);

  // My work: Pricing is open; Hero is in the Done column, shown on request.
  await page.getByRole("link", { name: "My work" }).click();
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /Pricing/ })).toBeVisible();
  await expect(main.getByRole("link", { name: /Hero/ })).toHaveCount(0);
  await main.getByLabel(/Show done/).click();
  await expect(main.getByRole("link", { name: /Hero/ })).toBeVisible();
  await main.getByRole("link", { name: /Pricing/ }).click();
  await expect(page).toHaveURL(/\?task=/);
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "Title" })).toHaveValue(
    "Pricing",
  );
});

test("teammates see each other typing and react to comments", async ({ browser }) => {
  test.setTimeout(90_000);
  const { owner, mate, slug, teammate } = await ownerAndAdmin(browser, "react");
  const projectUrl = await createProject(owner, slug, "Launch");
  await addTask(owner, "To do", "Write copy");
  await mate.goto(projectUrl);
  for (const p of [owner, mate]) {
    await expect(p.getByTestId("board-presence")).toContainText("Live");
  }

  await card(owner, "Write copy").click();
  await card(mate, "Write copy").click();
  const box = mate.getByRole("dialog").getByRole("combobox", { name: "Comment" });
  await box.pressSequentially("Draft is ready", { delay: 30 });
  await expect(owner.getByTestId("typing-hint")).toHaveText("Tara is typing…");
  await mate.getByRole("dialog").getByRole("button", { name: "Comment", exact: true }).click();

  const comment = owner
    .getByRole("dialog")
    .getByRole("listitem")
    .filter({ hasText: "Draft is ready" });
  await expect(comment).toBeVisible();
  await expect(owner.getByTestId("typing-hint")).toHaveText("");

  await comment.hover();
  await comment.getByRole("button", { name: "Add reaction" }).click();
  await owner.getByRole("button", { name: "Party" }).click();
  await expect(
    mate.getByRole("dialog").getByRole("button", { name: "Party: Omar Owner" }),
  ).toBeVisible();
  await mate.getByRole("dialog").getByRole("button", { name: "Party: Omar Owner" }).click();
  await expect(
    owner.getByRole("dialog").getByRole("button", { name: `Party: Omar Owner, ${teammate.name}` }),
  ).toHaveAttribute("aria-pressed", "true");
});
