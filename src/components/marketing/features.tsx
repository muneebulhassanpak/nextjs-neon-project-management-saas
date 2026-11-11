import {
  Clock,
  History,
  KanbanSquare,
  ShieldCheck,
  Timer,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { InView } from "@/components/motion/in-view";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./primitives";

const FEATURES: { icon: LucideIcon; title: string; description: string; featured?: boolean }[] = [
  {
    icon: KanbanSquare,
    title: "Boards for every project",
    description:
      "Drag tasks from To do to Done. Everyone sees what's happening without asking for an update.",
  },
  {
    icon: Timer,
    title: "Sprints that keep you on schedule",
    description:
      "Plan the next two weeks, see progress on a chart, and roll unfinished work forward.",
  },
  {
    icon: UsersRound,
    title: "A portal for your clients",
    description:
      "Clients see progress, milestones and files for their own projects, and nothing else.",
    featured: true,
  },
  {
    icon: Clock,
    title: "Time tracking and invoices",
    description: "Start a timer on any task, then turn tracked hours into an invoice in a click.",
  },
  {
    icon: History,
    title: "A full history of changes",
    description: "See who did what and when, for every task and project. No more guessing.",
  },
  {
    icon: ShieldCheck,
    title: "The right access for everyone",
    description:
      "Owners, admins, members and clients each see exactly what they should. Your data stays private.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything your team needs, in one place"
          description="Stop juggling a task app, a spreadsheet for hours and a folder of client emails."
        />
        <InView className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, featured }, index) => (
            <div
              key={title}
              className="lp-reveal"
              style={{ "--i": index % 3 } as React.CSSProperties}
            >
              <SpotlightCard
                className={cn(
                  "group h-full overflow-hidden rounded-2xl border p-6 transition-[translate,background-color,box-shadow] duration-300 ease-smooth hover:-translate-y-1 hover:shadow-lg hover:shadow-black/[0.04] motion-reduce:hover:translate-y-0",
                  featured
                    ? "lp-sheen lp-loop border-amber-200 bg-gradient-to-br from-amber-50 to-card dark:border-amber-500/20 dark:from-amber-500/10"
                    : "bg-card hover:bg-muted/40",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-xl border bg-background shadow-sm transition-transform duration-300 ease-smooth group-hover:-translate-y-0.5 group-hover:-rotate-6 motion-reduce:transition-none">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <h3 className="mt-6 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">{description}</p>
              </SpotlightCard>
            </div>
          ))}
        </InView>
      </div>
    </section>
  );
}
