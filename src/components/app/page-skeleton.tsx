import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for an app page while its data streams in. */
export function PageSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
