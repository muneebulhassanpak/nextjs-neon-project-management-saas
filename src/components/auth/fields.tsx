"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { ComponentProps, ReactNode } from "react";

const inputClass = "h-10 rounded-xl bg-background px-3.5 shadow-xs dark:bg-input/30";

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  /** Shown on the right of the label, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
};

function FieldShell({
  id,
  label,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A labelled input for the auth forms. */
export function TextField({ label, hint, aside, className, ...props }: FieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} aside={aside}>
      <Input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(inputClass, className)}
        {...props}
      />
    </FieldShell>
  );
}

/** A password input with a show/hide toggle. */
export function PasswordField({ label, hint, aside, className, ...props }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <FieldShell id={id} label={label} hint={hint} aside={aside}>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(inputClass, "pr-10", className)}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => {
            setVisible(!visible);
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
        >
          <Icon className="size-4" aria-hidden />
          {/* Text, not aria-label, so `getByLabel("Password")` still finds only the input. */}
          <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
        </button>
      </div>
    </FieldShell>
  );
}

/** The full-width, pill-shaped primary button style used on the auth pages. */
export const authSubmitClass =
  "h-10 w-full rounded-full bg-foreground text-background hover:bg-foreground/85";

/** Heading block at the top of each auth card. */
export function AuthHeading({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      {icon && (
        <span className="mb-2 flex size-11 items-center justify-center rounded-2xl border bg-background shadow-sm">
          {icon}
        </span>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}

/** "New here? Create an account" style line at the bottom of a card. */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export const authLinkClass = "font-medium text-foreground underline-offset-4 hover:underline";
