"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";

import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);

  if (!token || params.get("error")) {
    return (
      <div className="grid gap-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
        <p className="text-sm text-muted-foreground">This reset link is invalid or has expired.</p>
        <Link
          href="/forgot-password"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function reset(formData: FormData) {
    setError(null);
    const { error } = await authClient.resetPassword({
      newPassword: textField(formData, "password"),
      token: token ?? "",
    });
    if (error) setError(error.message ?? "Couldn't reset your password. Try again.");
    else router.push("/sign-in");
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      </div>
      <form action={reset} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error && <FormMessage>{error}</FormMessage>}
        <SubmitButton>Update password</SubmitButton>
      </form>
    </div>
  );
}
