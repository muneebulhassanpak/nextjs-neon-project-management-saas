"use client";

import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";

import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function requestReset(formData: FormData) {
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: textField(formData, "email"),
      redirectTo: "/reset-password",
    });
    if (error) setError(error.message ?? "Something went wrong. Try again.");
    else setSent(true);
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email you a link to choose a new one
        </p>
      </div>

      {sent ? (
        // Same message whether or not the account exists, so emails can't be probed.
        <FormMessage variant="success">
          If an account exists for that email, a reset link is on its way.
        </FormMessage>
      ) : (
        <form action={requestReset} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {error && <FormMessage>{error}</FormMessage>}
          <SubmitButton>Send reset link</SubmitButton>
        </form>
      )}

      <Link
        href="/sign-in"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
