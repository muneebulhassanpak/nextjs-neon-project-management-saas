"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { textField } from "@/lib/form-data";
import { safeNextPath } from "@/lib/routes";

import { FormMessage } from "./form-message";
import { SocialButtons, type SocialProvider } from "./social-buttons";
import { SubmitButton } from "./submit-button";

type Mode = "password" | "link";

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
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your Stackboard account</p>
      </div>

      <SocialButtons providers={providers} callbackURL={next} />

      <form action={signIn} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        {mode === "password" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
        )}

        {error && <FormMessage>{error}</FormMessage>}
        {notice && <FormMessage variant="success">{notice}</FormMessage>}

        <SubmitButton>{mode === "password" ? "Sign in" : "Email me a sign-in link"}</SubmitButton>
      </form>

      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        onClick={() => {
          setMode(mode === "password" ? "link" : "password");
          setError(null);
          setNotice(null);
        }}
      >
        {mode === "password"
          ? "Sign in with an email link instead"
          : "Sign in with a password instead"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        New to Stackboard?{" "}
        <Link
          href={`/sign-up${next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
