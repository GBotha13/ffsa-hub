// Shown automatically by Next.js for every (admin) route that doesn't define
// its own loading.tsx — the sidebar and chrome stay visible while this fills
// the content area. Eliminates the blank-screen pause between clicks.

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>

      <div className="space-y-3">
        <div className="h-10 w-full rounded bg-muted/60" />
        <div className="h-16 w-full rounded bg-muted/40" />
        <div className="h-16 w-full rounded bg-muted/40" />
        <div className="h-16 w-full rounded bg-muted/40" />
        <div className="h-16 w-full rounded bg-muted/40" />
      </div>
    </div>
  );
}
