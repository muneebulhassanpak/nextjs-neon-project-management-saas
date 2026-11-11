import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { enabledSocialProviders } from "@/server/auth/providers";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm providers={enabledSocialProviders()} />
    </Suspense>
  );
}
