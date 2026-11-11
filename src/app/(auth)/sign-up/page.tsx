import { Suspense } from "react";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { enabledSocialProviders } from "@/server/auth/providers";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm providers={enabledSocialProviders()} />
    </Suspense>
  );
}
