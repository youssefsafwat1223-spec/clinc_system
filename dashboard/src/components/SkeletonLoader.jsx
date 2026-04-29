export default function SkeletonLoader({ count = 3, height = 100 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg bg-gradient-to-r from-slate-700 to-slate-600 animate-pulse"
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
}
