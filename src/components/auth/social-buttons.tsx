"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export type SocialProvider = "google" | "github";

const LABELS: Record<SocialProvider, string> = { google: "Google", github: "GitHub" };

/** Sign-in buttons for the social providers configured on the server. */
export function SocialButtons({
  providers,
  callbackURL,
}: {
  providers: SocialProvider[];
  callbackURL: string;
}) {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  if (providers.length === 0) return null;

  return (
    <div className="grid gap-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="outline"
          disabled={pending !== null}
          onClick={() => {
            setPending(provider);
            void authClient.signIn.social({ provider, callbackURL });
          }}
        >
          Continue with {LABELS[provider]}
        </Button>
      ))}
      <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
