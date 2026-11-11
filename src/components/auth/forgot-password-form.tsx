"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";

import { AuthHeading, authSubmitClass, TextField } from "./fields";
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
      <AuthHeading
        icon={<KeyRound className="size-5" aria-hidden />}
        title="Reset your password"
        description="Enter your email and we'll send you a link to choose a new one."
      />

      {sent ? (
        // Same message whether or not the account exists, so emails can't be probed.
        <FormMessage variant="success">
          If an account exists for that email, a reset link is on its way.
        </FormMessage>
      ) : (
        <form action={requestReset} className="grid gap-4">
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          {error && <FormMessage>{error}</FormMessage>}
          <SubmitButton className={authSubmitClass}>Send reset link</SubmitButton>
        </form>
      )}

      <Link
        href="/sign-in"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
      </Link>
    </div>
  );
}
