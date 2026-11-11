import { Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { SectionHeading } from "./primitives";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For freelancers and small teams getting started.",
    cta: "Start for free",
    features: [
      "Up to 3 projects",
      "Up to 5 team members",
      "Boards and sprints",
      "Client portal",
      "Full change history",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "per member / month",
    description: "For agencies running client work every day.",
    cta: "Get started",
    featured: true,
    features: [
      "Unlimited projects and members",
      "Live boards with presence",
      "Time tracking and invoices",
      "File sharing with clients",
      "AI sprint summaries and client updates",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing that grows with you"
          description="Start free. Upgrade when your team or client list outgrows it."
        />
        <div className="mx-auto mt-14 grid max-w-3xl gap-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "flex flex-col rounded-3xl border bg-card p-8",
                plan.featured &&
                  "border-amber-300 bg-gradient-to-b from-amber-50 to-card shadow-xl shadow-amber-500/10 dark:border-amber-500/30 dark:from-amber-500/10",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.featured && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-medium text-amber-950">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                        plan.featured ? "bg-amber-400 text-amber-950" : "bg-muted",
                      )}
                    >
                      <Check className="size-3" aria-hidden />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={cn(
                  "mt-8 flex h-11 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  plan.featured
                    ? "bg-foreground text-background hover:bg-foreground/85"
                    : "border hover:bg-muted",
                )}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Stackboard is a portfolio project. Payments run in test mode, so no card is ever charged.
        </p>
      </div>
    </section>
  );
}
