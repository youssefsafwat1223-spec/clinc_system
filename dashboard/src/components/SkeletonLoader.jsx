export default function SkeletonLoader({ count = 3, height = 100, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-3xl border border-white/5 bg-white/[0.02] p-5 ${className}`}
      aria-hidden="true"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded bg-white/[0.06]" />
          <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
        </div>
        <div className="h-10 w-10 rounded-2xl bg-white/[0.06]" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="h-3 w-5/6 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, columns = 3, className = '' }) {
  const colsClass =
    columns === 2 ? 'md:grid-cols-2' : columns === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3';
  return (
    <div className={`grid gap-4 ${colsClass} ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
