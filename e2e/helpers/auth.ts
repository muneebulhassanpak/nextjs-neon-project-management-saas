import { expect, type Page } from "@playwright/test";

import { markEmailVerified } from "./db";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export const PASSWORD = "e2e-password-123";

/** Signs up through the form, verifies the email, and signs in. Starts on the sign-up page. */
export async function signUpAndSignIn(page: Page, name: string, email: string): Promise<void> {
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

  await markEmailVerified(email);

  // Same `next` the sign-up page had, so invitation flows return to the invitation.
  const next = new URL(page.url()).searchParams.get("next");
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** Signs in an existing, verified user and waits until `next` has loaded. */
export async function signIn(page: Page, email: string, next: string): Promise<void> {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname === next);
}
