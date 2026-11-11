const STACK = ["Next.js", "React", "TypeScript", "PostgreSQL", "Neon", "Vercel", "Cloudflare"];

/** Instead of a "trusted by" logo wall: what the product is honestly built on. */
export function BuiltWith() {
  return (
    <section aria-labelledby="built-with" className="border-y bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-10">
        <h2 id="built-with" className="text-sm font-medium text-muted-foreground">
          Built on the same tools as the fastest teams on the web
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {STACK.map((name) => (
            <li
              key={name}
              className="text-lg font-semibold tracking-tight text-foreground/50 transition-colors hover:text-foreground"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
