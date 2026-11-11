import { LayoutGrid } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2 font-semibold">
          <LayoutGrid className="size-5 text-primary" aria-hidden />
          Stackboard
        </div>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Projects, sprints and clients in one place
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Stackboard helps agencies and teams plan work, track progress and keep clients in the
          loop.
        </p>
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </main>
    </div>
  );
}
