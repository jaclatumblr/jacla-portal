import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/50",
        className
      )}
      {...props}
    />
  );
}

// 事前定義されたスケルトンバリエーション
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 md:p-6 bg-card/50 border border-border rounded-lg", className)}>
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 md:w-16 md:h-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function SkeletonEventCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 sm:p-6 bg-card/50 border border-border rounded-lg", className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-4" />
      <div className="flex flex-wrap gap-3 sm:gap-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function SkeletonMemberCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 md:p-6 bg-card/50 border border-border rounded-lg", className)}>
      <div className="flex items-start gap-3 md:gap-4">
        <Skeleton className="w-12 h-12 md:w-16 md:h-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonAnnouncementCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 md:p-6 bg-card border border-border rounded-lg", className)}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-5 w-16 rounded" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonEventCard,
  SkeletonMemberCard,
  SkeletonAnnouncementCard,
};
