"use client";

import { KeyRound, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";

import { AuthHeading, authLinkClass, authSubmitClass, PasswordField } from "./fields";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);

  if (!token || params.get("error")) {
    return (
      <div className="grid gap-6">
        <AuthHeading
          icon={<TriangleAlert className="size-5" aria-hidden />}
          title="Link expired"
          description="This reset link is invalid or has expired."
        />
        <Link href="/forgot-password" className={`text-sm ${authLinkClass}`}>
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
      <AuthHeading
        icon={<KeyRound className="size-5" aria-hidden />}
        title="Choose a new password"
        description="You'll use it the next time you sign in."
      />
      <form action={reset} className="grid gap-4">
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters."
        />
        {error && <FormMessage>{error}</FormMessage>}
        <SubmitButton className={authSubmitClass}>Update password</SubmitButton>
      </form>
    </div>
  );
}
