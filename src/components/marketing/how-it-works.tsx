import { SectionHeading } from "./primitives";

const STEPS = [
  {
    title: "Create your workspace",
    description: "Sign up and name your team. You get your own private space in under a minute.",
  },
  {
    title: "Invite your team and clients",
    description:
      "Send email invites and pick what each person can do: manage, work, or just watch.",
  },
  {
    title: "Plan, track and deliver",
    description:
      "Add projects and tasks, run sprints, track time and keep clients updated as you go.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in three steps"
          description="No setup calls, no training. If you can use email, you can use Stackboard."
        />
        <ol className="lp-steps relative mt-14 grid gap-4 md:grid-cols-3">
          {/* A line through the step numbers (md and up), drawn amber as it scrolls into view.
              It runs from the centre of the first number to the centre of the last. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-[2.625rem] right-[calc((100%-2rem)/3-2.625rem)] left-[2.625rem] z-10 hidden h-px bg-border md:block"
          >
            <div className="lp-steps-progress h-full bg-amber-400" />
          </div>
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="lp-reveal relative rounded-2xl border bg-card p-6"
              style={{ "--i": index } as React.CSSProperties}
            >
              <span className="relative z-20 flex size-9 items-center justify-center overflow-hidden rounded-full bg-foreground text-sm font-semibold text-background">
                {index + 1}
                <span
                  aria-hidden
                  className="lp-step-dot absolute inset-0 flex items-center justify-center bg-amber-400 text-amber-950 opacity-0"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  {index + 1}
                </span>
              </span>
              <h3 className="mt-6 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
