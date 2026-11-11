import { FakeAvatar, PillLink } from "./primitives";

export function FinalCta() {
  return (
    <section className="px-6 pb-24">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-gradient-to-b from-amber-100 via-amber-50 to-background px-6 py-20 text-center dark:from-amber-500/15 dark:via-amber-500/5">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
          <span aria-hidden className="flex -space-x-1.5">
            <FakeAvatar name="Ali Khan" color={0} className="size-9 text-xs" />
            <FakeAvatar name="Sara Malik" color={3} className="size-9 text-xs" />
            <FakeAvatar name="Omar Ray" color={2} className="size-9 text-xs" />
            <FakeAvatar name="Lina Park" color={4} className="size-9 text-xs" />
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Bring your projects, team and clients together
          </h2>
          <p className="text-muted-foreground">
            Set up your workspace in a minute. Free to start, no card required.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PillLink href="/sign-up">Start for free</PillLink>
            <PillLink href="/sign-in" variant="outline">
              Sign in
            </PillLink>
          </div>
        </div>
      </div>
    </section>
  );
}
