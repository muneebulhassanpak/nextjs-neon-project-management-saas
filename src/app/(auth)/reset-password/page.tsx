import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
