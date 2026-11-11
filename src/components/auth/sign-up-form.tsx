"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";
import { safeNextPath } from "@/lib/routes";

import {
  AuthFooter,
  AuthHeading,
  authLinkClass,
  authSubmitClass,
  PasswordField,
  TextField,
} from "./fields";
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
      <div className="grid gap-6">
        <AuthHeading
          icon={<MailCheck className="size-5" aria-hidden />}
          title="Check your inbox"
          description={
            <>
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{sentTo}</span>. Click it to finish
              creating your account.
            </>
          }
        />
        <AuthFooter>
          Wrong address?{" "}
          <button
            type="button"
            className={authLinkClass}
            onClick={() => {
              setSentTo(null);
            }}
          >
            Start over
          </button>
        </AuthFooter>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <AuthHeading
        title="Create your account"
        description="Free to start. Set up your workspace in a minute."
      />

      <SocialButtons providers={providers} callbackURL={next} />

      <form action={signUp} className="grid gap-4">
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Jane Cooper"
          required
          maxLength={100}
        />
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          defaultValue={invitedEmail}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters."
        />

        {error && <FormMessage>{error}</FormMessage>}

        <SubmitButton className={authSubmitClass}>Create account</SubmitButton>
      </form>

      <AuthFooter>
        Already have an account?{" "}
        <Link href="/sign-in" className={authLinkClass}>
          Sign in
        </Link>
      </AuthFooter>
    </div>
  );
}
