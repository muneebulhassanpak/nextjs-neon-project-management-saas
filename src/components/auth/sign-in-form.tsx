"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";
import { safeNextPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

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

type Mode = "password" | "link";

const MODES: { value: Mode; label: string }[] = [
  { value: "password", label: "Password" },
  { value: "link", label: "Email link" },
];

export function SignInForm({ providers }: { providers: SocialProvider[] }) {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [mode, setMode] = useState<Mode>("password");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function signIn(formData: FormData) {
    setError(null);
    setNotice(null);
    const email = textField(formData, "email");

    if (mode === "link") {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: next });
      if (error) setError(error.message ?? "Couldn't send the link. Try again.");
      else setNotice(`We sent a sign-in link to ${email}. It expires in 5 minutes.`);
      return;
    }

    const { error } = await authClient.signIn.email({
      email,
      password: textField(formData, "password"),
    });
    if (error) {
      setError(
        error.code === "EMAIL_NOT_VERIFIED"
          ? "Please verify your email first. We've sent you a new link."
          : (error.message ?? "Couldn't sign you in. Try again."),
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <AuthHeading title="Welcome back" description="Sign in to your Stackboard account." />

      <SocialButtons providers={providers} callbackURL={next} />

      <div
        role="group"
        aria-label="Sign-in method"
        className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
      >
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => {
              setMode(option.value);
              setError(null);
              setNotice(null);
            }}
            className={cn(
              "h-8 rounded-full text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              mode === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form action={signIn} className="grid gap-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />

        {mode === "password" ? (
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            aside={
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            }
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            We&apos;ll email you a link that signs you in, no password needed.
          </p>
        )}

        {error && <FormMessage>{error}</FormMessage>}
        {notice && <FormMessage variant="success">{notice}</FormMessage>}

        <SubmitButton className={authSubmitClass}>
          {mode === "password" ? "Sign in" : "Email me a sign-in link"}
        </SubmitButton>
      </form>

      <AuthFooter>
        New to Stackboard?{" "}
        <Link
          href={`/sign-up${next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`}`}
          className={authLinkClass}
        >
          Create an account
        </Link>
      </AuthFooter>
    </div>
  );
}
