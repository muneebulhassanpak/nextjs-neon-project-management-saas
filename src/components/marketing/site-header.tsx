import { Menu } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { PillLink } from "./primitives";
import { SectionNav } from "./section-nav";

// Absolute (`/#…`) so they also work from the auth pages.
export const SECTION_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * The header shared by the landing page and the auth pages. `minimal` drops the section links
 * and account buttons, for pages people reach while already signed in (onboarding, invitations).
 */
export function SiteHeader({ minimal = false }: { minimal?: boolean }) {
  if (minimal) {
    return (
      <header className="sticky top-0 z-40 bg-background/50 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
    );
  }

  return (
    <header className="lp-header sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Logo />

        <SectionNav links={SECTION_LINKS} />

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="hidden rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted sm:block"
          >
            Sign in
          </Link>
          <PillLink href="/sign-up" className="hidden sm:inline-flex">
            Get started
          </PillLink>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Stackboard</SheetTitle>
                <SheetDescription>Projects, team and clients in one place.</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {SECTION_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <a
                      href={link.href}
                      className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 p-4">
                <Button variant="outline" asChild>
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/sign-up">Get started for free</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
