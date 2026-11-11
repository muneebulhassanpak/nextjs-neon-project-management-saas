"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme: applyTheme } = useTheme();
  const button = useRef<HTMLButtonElement>(null);

  /** Switches the theme, revealing the new one as a circle growing from the button. */
  function setTheme(theme: string) {
    const root = document.documentElement;
    const rect = button.current?.getBoundingClientRect();
    if (
      !rect ||
      !("startViewTransition" in document) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      applyTheme(theme);
      return;
    }
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty("--vt-x", `${String(x)}px`);
    root.style.setProperty("--vt-y", `${String(y)}px`);
    root.style.setProperty("--vt-r", `${String(radius)}px`);
    root.dataset.themeTransition = "";
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        applyTheme(theme);
      });
    });
    void transition.finished.finally(() => {
      delete root.dataset.themeTransition;
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={button} variant="ghost" size="icon" aria-label="Change theme">
          <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            setTheme("light");
          }}
        >
          <Sun /> Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setTheme("dark");
          }}
        >
          <Moon /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setTheme("system");
          }}
        >
          <Monitor /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
