"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** One column (w-72) plus the gap between columns. */
const STEP = 288 + 12;
const FADE = "48px";

/**
 * The board's sideways scroller, without a scrollbar. Trackpads, Shift+wheel, the keyboard and
 * dragging a card to the edge still scroll it; an edge with more columns past it fades out and
 * gets an arrow that scrolls one column over.
 */
export function BoardScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setMore((current) =>
      current.left === left && current.right === right ? current : { left, right },
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    // Columns come and go and grow, so watch the content as well as the scroller.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    const mutations = new MutationObserver(() => {
      for (const child of el.children) observer.observe(child);
      measure();
    });
    mutations.observe(el, { childList: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [measure]);

  function scroll(direction: 1 | -1) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollBy({ left: direction * STEP, behavior: reduce ? "auto" : "smooth" });
  }

  const mask = `linear-gradient(to right, ${more.left ? "transparent" : "black"}, black ${FADE}, black calc(100% - ${FADE}), ${more.right ? "transparent" : "black"})`;

  return (
    <div className="relative -mx-6 flex min-h-0 flex-1">
      <div
        ref={ref}
        onScroll={measure}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="relative flex min-h-0 flex-1 [scrollbar-width:none] items-start gap-3 overflow-x-auto px-6 pb-4 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {more.left && (
        <ScrollButton
          label="Scroll to earlier columns"
          className="left-2"
          onClick={() => {
            scroll(-1);
          }}
        >
          <ChevronLeft aria-hidden />
        </ScrollButton>
      )}
      {more.right && (
        <ScrollButton
          label="Scroll to more columns"
          className="right-2"
          onClick={() => {
            scroll(1);
          }}
        >
          <ChevronRight aria-hidden />
        </ScrollButton>
      )}
    </div>
  );
}

function ScrollButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={label}
      // Mouse users get the arrow; keyboard users already scroll by moving focus.
      tabIndex={-1}
      onClick={onClick}
      className={`absolute top-1.5 z-10 rounded-full bg-background/90 shadow-sm backdrop-blur ${className}`}
    >
      {children}
    </Button>
  );
}
