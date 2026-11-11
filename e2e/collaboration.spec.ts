import { expect, test } from "@playwright/test";

import { signUpAndSignIn, uniqueEmail } from "./helpers/auth";
import { pendingInvitationId } from "./helpers/db";

test("a mention notifies a teammate, and changes show up in the activity feed", async ({
  browser,
}) => {
  // Two people sign up and act in turn, so this takes longer than the other flows.
  test.setTimeout(90_000);
  const slug = `collab-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const teammate = { name: "Tara Teammate", email: uniqueEmail("teammate") };

  // The owner sets up an organization with one project and task.
  const owner = await (await browser.newContext()).newPage();
  await owner.goto("/sign-up");
  await signUpAndSignIn(owner, "Omar Owner", uniqueEmail("collab-owner"));
  await owner.getByLabel("Organization name").fill("Collab Co");
  await owner.getByLabel("URL").fill(slug);
  await owner.getByRole("button", { name: "Create organization" }).click();
  await expect(owner).toHaveURL(new RegExp(`/${slug}$`));

  await owner.goto(`/${slug}/projects`);
  await owner.getByRole("button", { name: "New project" }).first().click();
  await owner.getByRole("dialog").getByLabel("Name").fill("Launch");
  await owner.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await expect(owner.getByRole("heading", { name: "Launch" })).toBeVisible();
  const projectUrl = owner.url();
  const todo = owner.getByRole("region", { name: "To do" });
  await todo.getByRole("button", { name: "Add task" }).click();
  await todo.getByLabel("New task title").fill("Write copy");
  await todo.getByLabel("New task title").press("Enter");
  await todo.getByLabel("New task title").press("Escape");

  // A teammate joins and becomes an admin, so they can see every project.
  await owner.goto(`/${slug}/settings/members`);
  await owner.getByRole("button", { name: "Invite people" }).click();
  const invite = owner.getByRole("dialog");
  await invite.getByLabel("Email").fill(teammate.email);
  await invite.getByRole("button", { name: "Send invitation" }).click();
  await expect(owner.getByText(`Invitation sent to ${teammate.email}`)).toBeVisible();
  await invite.getByRole("button", { name: "Done" }).click();

  const mate = await (await browser.newContext()).newPage();
  await mate.goto(`/invitations/${await pendingInvitationId(teammate.email)}`);
  await mate.getByRole("link", { name: "Create an account" }).click();
  await signUpAndSignIn(mate, teammate.name, teammate.email);
  await mate.getByRole("button", { name: "Accept invitation" }).click();
  await expect(mate).toHaveURL(new RegExp(`/${slug}$`));

  await owner.reload();
  const row = owner.getByRole("row", { name: new RegExp(teammate.name) });
  await row.getByRole("combobox", { name: `Role for ${teammate.name}` }).click();
  await owner.getByRole("option", { name: "Admin" }).click();
  await expect(owner.getByText(`${teammate.name} is now admin`)).toBeVisible();

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
  await expect(mate.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});
