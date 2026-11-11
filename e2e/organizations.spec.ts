import { expect, test } from "@playwright/test";

import { signUpAndSignIn, uniqueEmail } from "./helpers/auth";
import { pendingInvitationId } from "./helpers/db";

test.describe.configure({ mode: "serial" });

const owner = { name: "Olivia Owner", email: uniqueEmail("owner") };
const invitee = { name: "Ivan Invitee", email: uniqueEmail("invitee") };
const slug = `acme-${Date.now()}`;

test("a new user signs up and creates an organization", async ({ page }) => {
  await page.goto("/sign-up");
  await signUpAndSignIn(page, owner.name, owner.email);

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Organization name").fill("Acme Design");
  await page.getByLabel("URL").fill(slug);
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(page).toHaveURL(new RegExp(`/${slug}$`));
  await expect(page.getByRole("heading", { name: "Welcome, Olivia" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch organization" })).toContainText("Owner");
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto(`/${slug}/settings/members`);

  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("an owner invites someone, who signs up and joins", async ({ browser }) => {
  const ownerPage = await (await browser.newContext()).newPage();
  await ownerPage.goto("/sign-in");
  await ownerPage.getByLabel("Email").fill(owner.email);
  await ownerPage.getByLabel("Password").fill("e2e-password-123");
  await ownerPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await ownerPage.waitForURL(new RegExp(`/${slug}$`));

  await ownerPage.goto(`/${slug}/settings/members`);
  await ownerPage.getByRole("button", { name: "Invite people" }).click();
  await ownerPage.getByLabel("Email").fill(invitee.email);
  await ownerPage.getByRole("button", { name: "Send invitation" }).click();
  await expect(ownerPage.getByText(`Invitation sent to ${invitee.email}`)).toBeVisible();
  await ownerPage.getByRole("button", { name: "Done" }).click();
  await expect(ownerPage.getByText(invitee.email, { exact: true })).toBeVisible();

  // The invitee opens the link from the email in a fresh browser.
  const inviteePage = await (await browser.newContext()).newPage();
  await inviteePage.goto(`/invitations/${await pendingInvitationId(invitee.email)}`);
  await expect(inviteePage.getByRole("heading", { name: "Join Acme Design" })).toBeVisible();
  await inviteePage.getByRole("link", { name: "Create an account" }).click();
  await expect(inviteePage.getByLabel("Work email")).toHaveValue(invitee.email);

  await signUpAndSignIn(inviteePage, invitee.name, invitee.email);
  await inviteePage.getByRole("button", { name: "Accept invitation" }).click();

  await expect(inviteePage).toHaveURL(new RegExp(`/${slug}$`));
  await expect(inviteePage.getByRole("button", { name: "Switch organization" })).toContainText(
    "Member",
  );

  // The owner sees the new member and can change their role.
  await ownerPage.reload();
  const row = ownerPage.getByRole("row", { name: new RegExp(invitee.name) });
  await expect(row).toBeVisible();
  await row.getByRole("combobox", { name: `Role for ${invitee.name}` }).click();
  await ownerPage.getByRole("option", { name: "Client" }).click();
  await expect(ownerPage.getByText(`${invitee.name} is now client`)).toBeVisible();
});

test("members can't open organizations they don't belong to", async ({ page }) => {
  const outsider = uniqueEmail("outsider");
  await page.goto("/sign-up");
  await signUpAndSignIn(page, "Oscar Outsider", outsider);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.goto(`/${slug}`);

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
