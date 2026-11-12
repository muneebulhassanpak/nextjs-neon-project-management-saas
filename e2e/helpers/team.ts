import { expect, type Browser, type Page } from "@playwright/test";

import { signUpAndSignIn, uniqueEmail } from "./auth";
import { pendingInvitationId } from "./db";

export interface Team {
  slug: string;
  /** Signed in as "Omar Owner", on the organization's overview. */
  owner: Page;
  /** Signed in as "Tara Teammate", an admin, so they can see every project. */
  mate: Page;
  teammate: { name: string; email: string };
}

/** A new organization with an owner and an admin, each in their own browser. */
export async function ownerAndAdmin(browser: Browser, prefix: string): Promise<Team> {
  const slug = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const teammate = { name: "Tara Teammate", email: uniqueEmail(`${prefix}-teammate`) };

  const owner = await (await browser.newContext()).newPage();
  await owner.goto("/sign-up");
  await signUpAndSignIn(owner, "Omar Owner", uniqueEmail(`${prefix}-owner`));
  await owner.getByLabel("Organization name").fill("Collab Co");
  await owner.getByLabel("URL").fill(slug);
  await owner.getByRole("button", { name: "Create organization" }).click();
  await expect(owner).toHaveURL(new RegExp(`/${slug}$`));

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

  return { slug, owner, mate, teammate };
}

/** Creates a project as the owner and returns its board's URL. */
export async function createProject(owner: Page, slug: string, name: string): Promise<string> {
  await owner.goto(`/${slug}/projects`);
  await owner.getByRole("button", { name: "New project" }).first().click();
  await owner.getByRole("dialog").getByLabel("Name").fill(name);
  await owner.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await expect(owner.getByRole("heading", { name })).toBeVisible();
  return owner.url();
}

/** Adds a task at the bottom of a column through its inline form. */
export async function addTask(page: Page, column: string, title: string): Promise<void> {
  const region = page.getByRole("region", { name: column });
  await region.getByRole("button", { name: "Add task" }).click();
  await region.getByLabel("New task title").fill(title);
  await region.getByLabel("New task title").press("Enter");
  await region.getByLabel("New task title").press("Escape");
}
