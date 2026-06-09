// Tailored skeleton for the contact detail page — mirrors the 2-column dossier
// layout so the click-through from /contacts → /contacts/[id] feels instant
// instead of flashing blank for ~800ms while 6 parallel queries resolve.

export default function ContactDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-3 w-20 rounded bg-muted" />

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3 w-40 rounded bg-muted" />
          <div className="h-8 w-72 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-muted/70" />
          <div className="h-6 w-16 rounded-full bg-muted/70" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <CardBlock lines={3} />
          <CardBlock lines={5} title />
          <CardBlock lines={3} title />
          <CardBlock lines={3} title />
        </div>
        <div className="space-y-6">
          <CardBlock lines={2} title />
          <CardBlock lines={1} title />
        </div>
      </div>
    </div>
  );
}

function CardBlock({ lines, title = false }: { lines: number; title?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      {title && <div className="h-4 w-32 rounded bg-muted" />}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 w-full rounded bg-muted/50" />
      ))}
    </div>
  );
}
