import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
}

/** Whether the viewport is mobile-sized. Server render assumes desktop. */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

const noSubscription = () => () => undefined;

/**
 * False while this component hydrates, true after. A part of the page that streams in after the
 * rest has hydrated sees `useIsMobile()` already true, so it must not trust it until it has
 * hydrated itself (the server rendered the desktop version).
 */
export function useHydrated() {
  return React.useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
