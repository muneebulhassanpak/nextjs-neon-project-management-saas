/** Page numbers to show around `page`: first, last, neighbours, and `null` for a gap. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const shown = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...shown].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of pages) {
    const previous = out.at(-1);
    if (typeof previous === "number" && n - previous === 2) out.push(n - 1);
    else if (typeof previous === "number" && n - previous > 2) out.push(null);
    out.push(n);
  }
  return out;
}
