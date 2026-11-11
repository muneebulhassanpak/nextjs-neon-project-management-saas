import { Check, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

import { FakeAvatar, Glow, MockCard, PillLink, SectionHeading } from "./primitives";

export function Showcase() {
  return (
    <section className="relative isolate overflow-hidden bg-muted/30 py-24">
      <Glow className="top-1/3 -left-40 h-96 w-96" />
      <div className="mx-auto flex max-w-6xl flex-col gap-24 px-6">
        <Row
          eyebrow="Client portal"
          title="Keep clients in the loop, minus the email chains"
          description="Invite a client and they get their own view: live progress, upcoming milestones and shared files. They can't see your internal tasks, other clients or anything you don't share."
          points={[
            "Read-only, so nothing gets changed by accident",
            "Updates the moment your team moves a task",
            "One link to send instead of weekly status emails",
          ]}
          visual={<PortalVisual />}
        />
        <Row
          reverse
          eyebrow="Live boards"
          title="See work move as it happens"
          description="When someone drags a task, everyone's board updates instantly. You can see who else is looking at the same board, so nobody steps on each other's toes."
          points={[
            "No refreshing, no stale lists",
            "See who's online on each board",
            "Works on laptops, tablets and phones",
          ]}
          visual={<BoardVisual />}
        />
      </div>
    </section>
  );
}

function Row({
  eyebrow,
  title,
  description,
  points,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div className={cn("flex flex-col gap-6", reverse && "lg:order-2")}>
        <SectionHeading align="left" eyebrow={eyebrow} title={title} description={description} />
        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <Check className="size-3" aria-hidden />
              </span>
              {point}
            </li>
          ))}
        </ul>
        <PillLink href="/sign-up" className="self-start">
          Try it free
        </PillLink>
      </div>
      <div aria-hidden className="rounded-3xl border bg-background/60 p-6 shadow-sm sm:p-10">
        {visual}
      </div>
    </div>
  );
}

const MILESTONES = [
  { name: "Discovery", state: "done" },
  { name: "Design", state: "done" },
  { name: "Development", state: "active" },
  { name: "Launch", state: "todo" },
] as const;

function PortalVisual() {
  return (
    <MockCard className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Northwind Studio</p>
          <p className="font-semibold">Website redesign</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          On track
        </span>
      </div>
      <div className="mt-5 flex justify-between text-xs">
        <span className="text-muted-foreground">Overall progress</span>
        <span className="font-medium">64%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted">
        <div className="h-full w-[64%] rounded-full bg-primary" />
      </div>
      <ol className="mt-6 flex flex-col gap-3">
        {MILESTONES.map((m) => (
          <li key={m.name} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border",
                m.state === "done" && "border-transparent bg-foreground text-background",
                m.state === "active" && "border-primary",
              )}
            >
              {m.state === "done" && <Check className="size-3" />}
              {m.state === "active" && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className={cn(m.state === "todo" && "text-muted-foreground")}>{m.name}</span>
            {m.state === "active" && (
              <span className="ml-auto text-xs text-muted-foreground">Due Nov 28</span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-6 flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
        <FileText className="size-4 text-muted-foreground" />
        <span className="flex-1 text-xs">homepage-designs-v3.pdf</span>
        <span className="text-[0.65rem] text-muted-foreground">Shared today</span>
      </div>
    </MockCard>
  );
}

const COLUMNS = [
  {
    name: "To do",
    tasks: [
      { title: "Write launch email", tag: "Marketing", who: "Ali Khan", color: 0 },
      { title: "Pricing page copy", tag: "Content", who: "Omar Ray", color: 2 },
    ],
  },
  {
    name: "In progress",
    tasks: [
      { title: "Checkout flow", tag: "Development", who: "Sara Malik", color: 3, moving: true },
    ],
  },
  {
    name: "Done",
    tasks: [{ title: "Brand colours", tag: "Design", who: "Lina Park", color: 4 }],
  },
];

function BoardVisual() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Launch board</p>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex -space-x-1.5">
            <FakeAvatar name="Ali Khan" color={0} />
            <FakeAvatar name="Sara Malik" color={3} />
          </span>
          2 viewing
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COLUMNS.map((column) => (
          <div
            key={column.name}
            className="flex flex-col gap-2 rounded-xl bg-muted/60 p-2 last:hidden sm:last:flex"
          >
            <p className="px-1 text-[0.7rem] font-medium text-muted-foreground">
              {column.name} · {column.tasks.length}
            </p>
            {column.tasks.map((task) => (
              <div
                key={task.title}
                className={cn(
                  "rounded-lg border bg-card p-2.5 shadow-sm",
                  "moving" in task && "rotate-2 border-primary/40 shadow-lg ring-2 ring-primary/20",
                )}
              >
                <p className="text-xs font-medium">{task.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                    {task.tag}
                  </span>
                  <FakeAvatar name={task.who} color={task.color} className="size-5 text-[0.5rem]" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
