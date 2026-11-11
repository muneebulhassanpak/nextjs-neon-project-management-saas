import { Check } from "lucide-react";

import { FakeAvatar, Glow, MockCard } from "@/components/marketing/primitives";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { cn } from "@/lib/utils";

const POINTS = [
  "Boards, sprints and time tracking in one place",
  "A read-only portal so clients see progress, not your inbox",
  "Free to start. No credit card needed",
];

/**
 * Page frame for auth, onboarding and invitation pages: the landing page's header and footer
 * around a card. With `aside`, a product panel sits next to the card on large screens.
 * `minimal` is for pages people reach while signed in: no sign-in buttons, no marketing footer.
 */
export function AuthShell({
  children,
  aside = false,
  minimal = false,
}: {
  children: React.ReactNode;
  aside?: boolean;
  minimal?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader minimal={minimal} />
      <main className="relative isolate flex flex-1 overflow-hidden">
        <Glow className="top-[-14rem] left-1/2 h-[30rem] w-[50rem] -translate-x-1/2" />
        <div
          className={cn(
            "mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-12 sm:py-16",
            aside && "lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-16",
          )}
        >
          <div
            className={cn(
              "w-full max-w-md animate-in rounded-3xl border bg-card/90 p-6 shadow-xl shadow-black/[0.04] backdrop-blur duration-500 fade-in slide-in-from-bottom-2 motion-reduce:animate-none sm:p-8 dark:shadow-black/30",
              aside ? "mx-auto lg:mx-0" : "mx-auto",
            )}
          >
            {children}
          </div>
          {aside && <AuthAside />}
        </div>
      </main>
      {!minimal && <SiteFooter />}
    </div>
  );
}

function AuthAside() {
  return (
    <aside className="hidden flex-col gap-8 rounded-3xl border bg-gradient-to-br from-amber-50 via-background to-background p-10 lg:flex dark:from-amber-500/10">
      <div className="grid gap-3">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">
          Run your projects, team and clients in one place
        </h2>
        <ul className="mt-2 grid gap-3">
          {POINTS.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="size-3" aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div aria-hidden className="grid gap-4 sm:grid-cols-2">
        <MockCard>
          <p className="text-xs text-muted-foreground">Northwind Studio</p>
          <p className="font-medium">Website redesign</p>
          <div className="mt-4 flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">64%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div className="h-full w-[64%] rounded-full bg-primary" />
          </div>
        </MockCard>
        <MockCard className="flex flex-col justify-between">
          <p className="text-2xl font-semibold tracking-tight">18 / 21</p>
          <p className="text-xs text-muted-foreground">Tasks done this sprint</p>
          <span className="mt-3 flex -space-x-1.5">
            <FakeAvatar name="Ali Khan" color={0} />
            <FakeAvatar name="Sara Malik" color={3} />
            <FakeAvatar name="Omar Ray" color={2} />
          </span>
        </MockCard>
      </div>
    </aside>
  );
}
