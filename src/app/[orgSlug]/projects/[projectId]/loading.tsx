import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div data-wide className="grid gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-8 w-96 max-w-full" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
