import { expect, test } from "@playwright/test";

import { addTask, createProject, ownerAndAdmin } from "./helpers/team";

test("a mention notifies a teammate, and changes show up in the activity feed", async ({
  browser,
}) => {
  // Two people sign up and act in turn, so this takes longer than the other flows.
  test.setTimeout(90_000);
  const { owner, mate, slug, teammate } = await ownerAndAdmin(browser, "collab");
  const projectUrl = await createProject(owner, slug, "Launch");
  await addTask(owner, "To do", "Write copy");

  // The owner mentions the teammate in a comment, picking them from the suggestions.
  await owner.goto(projectUrl);
  await owner.getByRole("button", { name: /Write copy/ }).click();
  const sheet = owner.getByRole("dialog");
  const box = sheet.getByRole("combobox", { name: "Comment" });
  await box.fill("@Ta");
  await sheet.getByRole("option", { name: teammate.name }).click();
  // Typing straight after the pick continues after the name.
  await box.pressSequentially("can you review this?");
  await expect(box).toHaveValue(`@${teammate.name} can you review this?`);
  await sheet.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(
    sheet.getByRole("listitem").filter({ hasText: "can you review this" }),
  ).toContainText(`@${teammate.name}`);

  // Moving the task shows up in the project's activity.
  await sheet.getByRole("combobox", { name: "Status" }).click();
  await owner.getByRole("option", { name: "In progress" }).click();
  await owner.keyboard.press("Escape");
  await owner.getByRole("tab", { name: "Activity" }).click();
  await expect(owner.getByText("moved Write copy from To do to In progress")).toBeVisible();
  await expect(owner.getByText("commented on Write copy")).toBeVisible();

  // The teammate sees the notification and it opens the task.
  await mate.reload();
  const bell = mate.getByRole("button", { name: "Notifications, 1 unread" });
  await bell.click();
  await mate.getByRole("link", { name: /Omar Owner mentioned you in Write copy/ }).click();
  await expect(mate).toHaveURL(/\?task=/);
  const opened = mate.getByRole("dialog");
  await expect(opened.getByText("can you review this?")).toBeVisible();
  // The open sheet hides the page behind it from assistive tech, so close it to check the bell.
  await mate.keyboard.press("Escape");
  await expect(mate.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});
