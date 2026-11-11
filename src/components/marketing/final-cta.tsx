import { InView } from "@/components/motion/in-view";

import { FakeAvatar, PillLink } from "./primitives";

const TEAM = [
  { name: "Ali Khan", color: 0 },
  { name: "Sara Malik", color: 3 },
  { name: "Omar Ray", color: 2 },
  { name: "Lina Park", color: 4 },
];

// How far each avatar moves when the section is hovered: they fan out from the middle.
const FAN = ["-12px", "-6px", "0px", "6px", "12px"];

export function FinalCta() {
  return (
    <section className="group/cta px-6 pb-24">
      <div className="lp-reveal relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl border bg-gradient-to-b from-amber-100 via-amber-50 to-background px-6 py-20 text-center dark:from-amber-500/15 dark:via-amber-500/5">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
          <InView className="flex -space-x-1.5" aria-hidden>
            {TEAM.map((person, index) => (
              <FakeAvatar
                key={person.name}
                name={person.name}
                color={person.color}
                style={{ "--fan": FAN[index] } as React.CSSProperties}
                className="size-9 text-xs transition-transform duration-300 ease-smooth group-hover/cta:translate-x-(--fan) motion-reduce:transition-none"
              />
            ))}
            {/* An empty seat for the visitor. */}
            <span
              style={{ "--fan": FAN[4] } as React.CSSProperties}
              className="inline-flex size-9 items-center justify-center rounded-full border-2 border-dashed border-amber-500/70 bg-background text-[0.6rem] font-semibold text-amber-700 transition-transform duration-300 ease-smooth group-hover/cta:translate-x-(--fan) motion-reduce:transition-none dark:text-amber-300"
            >
              <span className="lp-pulse lp-loop">+ you</span>
            </span>
          </InView>
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
