import {
  Clock,
  History,
  KanbanSquare,
  ShieldCheck,
  Timer,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

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
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, featured }) => (
            <article
              key={title}
              className={cn(
                "group rounded-2xl border p-6 transition-colors",
                featured
                  ? "border-amber-200 bg-gradient-to-br from-amber-50 to-card dark:border-amber-500/20 dark:from-amber-500/10"
                  : "bg-card hover:bg-muted/40",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl border bg-background shadow-sm">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="mt-6 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
