import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading executive dashboard">
      <div><Skeleton className="h-6 w-44" /><Skeleton className="mt-3 h-9 w-80 max-w-full" /><Skeleton className="mt-3 h-5 w-[32rem] max-w-full" /></div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">{Array.from({ length: 9 }, (_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</div>
      <div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-80 rounded-xl" />)}</div>
    </div>
  );
}
