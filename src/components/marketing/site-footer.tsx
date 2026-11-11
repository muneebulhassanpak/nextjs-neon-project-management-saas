import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const REPO_URL = "https://github.com/muneebulhassanpak/nextjs-neon-project-management-saas";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-up", label: "Sign up" },
      { href: "/sign-in", label: "Sign in" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: REPO_URL, label: "Source code", external: true },
      { href: `${REPO_URL}/blob/main/CHANGELOG.md`, label: "Changelog", external: true },
      { href: "https://heymuneeb.dev", label: "Built by Muneeb", external: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            Projects, sprints, time tracking and a client portal for agencies and small teams.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">{column.title}</h2>
            {column.links.map((link) =>
              "external" in link ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © 2026 Stackboard. A portfolio project, open source under the MIT license.
        </p>
      </div>
    </footer>
  );
}
