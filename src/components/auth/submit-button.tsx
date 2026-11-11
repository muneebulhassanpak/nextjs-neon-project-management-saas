"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import type { ComponentProps } from "react";

/** A submit button that shows a spinner and disables itself while its form is submitting. */
export function SubmitButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
