"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";
import { safeNextPath } from "@/lib/routes";

import { FormMessage } from "./form-message";
import { SocialButtons, type SocialProvider } from "./social-buttons";
import { SubmitButton } from "./submit-button";

export function SignUpForm({ providers }: { providers: SocialProvider[] }) {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  // Prefilled when arriving from an invitation, so the account matches the invited email.
  const invitedEmail = params.get("email") ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function signUp(formData: FormData) {
    setError(null);
    const email = textField(formData, "email");
    const { error } = await authClient.signUp.email({
      name: textField(formData, "name"),
      email,
      password: textField(formData, "password"),
      callbackURL: next,
    });
    if (error) setError(error.message ?? "Couldn't create your account. Try again.");
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="grid gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{sentTo}</span>. Click it to finish creating
          your account.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start managing projects with your team</p>
      </div>

      <SocialButtons providers={providers} callbackURL={next} />

      <form action={signUp} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={100} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={invitedEmail}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        </div>

        {error && <FormMessage>{error}</FormMessage>}

        <SubmitButton>Create account</SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
