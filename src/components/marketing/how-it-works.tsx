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
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl border bg-card p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                {index + 1}
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
