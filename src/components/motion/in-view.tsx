"use client";

import { useEffect, useRef } from "react";

/**
 * Marks its box `data-inview="true|false"` as it enters and leaves the screen, so CSS loops
 * inside (`.lp-loop`) only run while they can be seen. Renders a plain `div`.
 */
export function InView({ children, ...props }: Omit<React.ComponentProps<"div">, "ref">) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      element.dataset.inview = String(entry?.isIntersecting ?? true);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
