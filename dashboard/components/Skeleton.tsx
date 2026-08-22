/** Placeholder saat snapshot pertama masih dimuat. */
export default function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse space-y-3">
            <div className="h-8 w-8 rounded-lg bg-ink/10" />
            <div className="h-6 w-4/5 rounded bg-ink/10" />
            <div className="h-3 w-2/3 rounded bg-ink/5" />
          </div>
        ))}
      </div>
      <div className="card animate-pulse">
        <div className="h-4 w-40 rounded bg-ink/10" />
        <div className="mt-4 h-48 rounded-xl bg-ink/5" />
      </div>
    </div>
  );
}
