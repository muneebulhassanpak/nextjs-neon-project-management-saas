import { expect, test } from "@playwright/test";

import { addTask, createProject, ownerAndAdmin } from "./helpers/team";

test("changes and who's looking show up live on a teammate's board", async ({ browser }) => {
  test.setTimeout(90_000);
  const { owner, mate, slug, teammate } = await ownerAndAdmin(browser, "live");
  const projectUrl = await createProject(owner, slug, "Launch");
  await mate.goto(projectUrl);

  // Both are connected, and each sees the other.
  for (const page of [owner, mate]) {
    await expect(page.getByTestId("board-presence")).toContainText("Live");
  }
  await expect(owner.getByTestId("board-presence")).toContainText(teammate.name);
  await expect(mate.getByTestId("board-presence")).toContainText("Omar Owner");

  // A task the owner adds appears on the teammate's board without a reload.
  await addTask(owner, "To do", "Write copy");
  const card = (page: typeof mate, column: string) =>
    page.getByRole("region", { name: column }).getByRole("button", { name: /Write copy/ });
  await expect(card(mate, "To do")).toBeVisible();

  // The teammate opens it and moves it; the owner sees the move and who's looking.
  await card(mate, "To do").click();
  await mate.getByRole("dialog").getByRole("combobox", { name: "Status" }).click();
  await mate.getByRole("option", { name: "In progress" }).click();
  await expect(card(owner, "In progress")).toBeVisible();

  await card(owner, "In progress").click();
  await expect(owner.getByTestId("task-viewers")).toContainText(
    "Tara is also looking at this task",
  );

  // When the teammate closes the task, the owner no longer sees them on it.
  await mate.keyboard.press("Escape");
  await expect(owner.getByTestId("task-viewers")).toBeHidden();
});
