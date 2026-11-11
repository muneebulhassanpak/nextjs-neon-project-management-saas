import { Plus } from "lucide-react";

import { SectionHeading } from "./primitives";

const QUESTIONS = [
  {
    question: "Is Stackboard free to try?",
    answer:
      "Yes. The Free plan has no time limit and doesn't ask for a card. You can upgrade later if you need more projects or members.",
  },
  {
    question: "Can my clients see their project?",
    answer:
      "Yes. Invite a client by email and they get a read-only view of their own projects: progress, milestones and the files you share. They never see your other clients or internal discussions.",
  },
  {
    question: "Who can see and change what?",
    answer:
      "There are four roles. Owners and admins manage the team and settings, members do the work, and clients can only view their own projects. You choose the role when you invite someone.",
  },
  {
    question: "Is my data kept separate from other companies?",
    answer:
      "Yes. Every workspace's data is walled off at the database level, so one company can never read another's projects, even by mistake.",
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. Stackboard runs in your browser on any computer, tablet or phone. Just sign up and start.",
  },
  {
    question: "Can I move my team over from another tool?",
    answer:
      "Yes. Create your projects, invite your team by email and you're ready. Most teams are set up within an afternoon.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mt-12 flex flex-col gap-3">
          {QUESTIONS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border bg-card px-6 open:bg-muted/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <p className="pb-5 text-sm text-pretty text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
