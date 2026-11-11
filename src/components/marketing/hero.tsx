import { Bell, CalendarDays, CheckCircle2, Clock, MoreHorizontal } from "lucide-react";

import { CountUp } from "@/components/motion/count-up";
import { InView } from "@/components/motion/in-view";
import { cn } from "@/lib/utils";

import { Eyebrow, FakeAvatar, Glow, MockCard, PillLink } from "./primitives";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Glow className="lp-breathe top-[-12rem] left-1/2 h-[36rem] w-[60rem] -translate-x-1/2" />
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-16 pb-20 text-center sm:pt-24">
        <div className="flex animate-in flex-col items-center gap-6 duration-700 fade-in slide-in-from-bottom-4 motion-reduce:animate-none">
          <Eyebrow>For agencies, freelancers and small teams</Eyebrow>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Run your projects, team and clients{" "}
            <span className="text-muted-foreground">in one place</span>
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Plan work on simple boards, run sprints, track time and give clients a live view of
            their project, without the spreadsheets and email chains.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PillLink href="/sign-up">Start for free</PillLink>
            <PillLink href="#how-it-works" variant="outline">
              See how it works
            </PillLink>
          </div>
          <p className="text-xs text-muted-foreground">Free plan · No credit card needed</p>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

// `order` staggers the bars as they grow in; the best month lands last.
const BARS = [
  { month: "Jul", value: 38, order: 0 },
  { month: "Aug", value: 52, order: 1 },
  { month: "Sep", value: 86, order: 4, highlight: true },
  { month: "Oct", value: 61, order: 2 },
  { month: "Nov", value: 70, order: 3 },
];

/** A collage of product-UI cards. Decorative, so it's hidden from screen readers. */
function HeroVisual() {
  return (
    <InView className="w-full">
      <HeroCards />
    </InView>
  );
}

function HeroCards() {
  return (
    <div
      aria-hidden
      className="mt-16 grid w-full animate-in grid-cols-1 gap-4 text-left delay-150 duration-1000 fill-mode-both fade-in slide-in-from-bottom-8 motion-reduce:animate-none md:grid-cols-[1fr_1.15fr_1fr] md:items-start"
    >
      {/* Left column */}
      <div className="lp-float lp-loop hidden flex-col gap-4 md:mt-10 md:flex">
        <MockCard className="relative">
          <span className="lp-wiggle lp-loop absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-xl bg-amber-400 text-amber-950 shadow-md">
            <Bell className="size-4" />
          </span>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              WR
            </span>
            <div>
              <p className="font-medium">Website redesign</p>
              <p className="text-xs text-muted-foreground">Client: Northwind Studio</p>
            </div>
          </div>
          <div className="mt-5 flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <CountUp to={64} format="percent" delay={600} className="font-medium tabular-nums" />
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted">
            <div className="lp-fill h-full w-[64%] rounded-full bg-primary" />
          </div>
        </MockCard>
        <MockCard className="flex items-center gap-3 py-3">
          <FakeAvatar name="Sara Malik" color={3} className="size-9 text-xs" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sara Malik</p>
            <p className="text-xs text-muted-foreground">Designer</p>
          </div>
          <span className="rounded-full bg-foreground px-2 py-0.5 text-[0.65rem] font-medium text-background">
            9 tasks
          </span>
        </MockCard>
      </div>

      {/* Centre: tasks completed */}
      <MockCard className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">Tasks completed</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CountUp
                to={86}
                delay={500}
                className="min-w-[3.5ch] rounded-full bg-foreground px-1.5 py-0.5 text-center text-[0.6rem] font-semibold text-background tabular-nums"
              />
              Best month yet
            </p>
          </div>
          <span className="rounded-full border px-2 py-0.5 text-[0.65rem] text-muted-foreground">
            Monthly
          </span>
        </div>
        <div className="mt-8 flex items-end gap-3">
          {BARS.map((bar) => (
            <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-36 w-full items-end">
                <div
                  className={cn(
                    "lp-bar relative w-full rounded-lg",
                    bar.highlight ? "bg-foreground" : "bg-muted",
                  )}
                  style={
                    { height: `${String(bar.value)}%`, "--i": bar.order } as React.CSSProperties
                  }
                >
                  {bar.highlight && (
                    <span
                      // Pops in once its bar has landed.
                      style={{ "--delay": "1.5s" } as React.CSSProperties}
                      className="lp-pop absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-full bg-primary px-1.5 py-0.5 text-[0.6rem] font-semibold text-primary-foreground"
                    >
                      +24
                    </span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "text-[0.65rem]",
                  bar.highlight ? "font-medium" : "text-muted-foreground",
                )}
              >
                {bar.month}
              </span>
            </div>
          ))}
        </div>
      </MockCard>

      {/* Right column */}
      <div className="lp-float-alt lp-loop hidden flex-col gap-4 md:flex">
        <MockCard className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              <CountUp to={32 * 60 + 10} format="duration" delay={700} duration={1500} />
            </p>
            <p className="text-xs text-muted-foreground">Tracked this week</p>
          </div>
          <span className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
            <Clock className="size-4" />
          </span>
        </MockCard>
        <MockCard>
          <div className="flex items-start justify-between">
            <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
              <CheckCircle2 className="size-4" />
            </span>
            <MoreHorizontal className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-4 font-medium">Sprint 12 review</p>
          <p className="mt-1 text-xs text-muted-foreground">
            18 of 21 tasks done. 3 move to the next sprint.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem] text-muted-foreground">
              <CalendarDays className="size-3" /> Fri, 4:00 pm
            </span>
            <span className="flex -space-x-1.5">
              <FakeAvatar name="Ali Khan" color={0} />
              <FakeAvatar name="Sara Malik" color={3} />
              <FakeAvatar name="Omar Ray" color={2} />
            </span>
          </div>
        </MockCard>
      </div>
    </div>
  );
}
