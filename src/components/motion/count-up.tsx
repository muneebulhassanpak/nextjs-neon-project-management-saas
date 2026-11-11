"use client";

import { useEffect, useRef } from "react";

import { formatCount, type CountFormat } from "@/lib/format";

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts from 0 up to `to` after `delay` ms. The final value is rendered on the server and kept
 * for reduced motion, so the number is right even without JavaScript.
 */
export function CountUp({
  to,
  format = "number",
  delay = 0,
  duration = 1200,
  className,
}: {
  to: number;
  format?: CountFormat;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now() + delay;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      element.textContent = formatCount(to * easeOut(t), format);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    element.textContent = formatCount(0, format);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = formatCount(to, format);
    };
  }, [to, format, delay, duration]);

  return (
    <span ref={ref} className={className}>
      {formatCount(to, format)}
    </span>
  );
}
