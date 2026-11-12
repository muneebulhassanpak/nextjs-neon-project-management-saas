/**
 * Background and text classes for an avatar without a photo, picked from the person's id so
 * everyone keeps the same colour everywhere. Listed in full so Tailwind keeps the classes.
 */
const TONES = [
  "bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200",
  "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-200",
  "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200",
  "bg-amber-500/20 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
  "bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200",
  "bg-cyan-500/15 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-200",
  "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-200",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-200",
] as const;

export function avatarTone(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length] ?? TONES[0];
}

export const AVATAR_TONE_COUNT = TONES.length;
