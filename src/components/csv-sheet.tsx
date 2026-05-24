import { toSheetEntries } from "@/lib/csv-sheet";

/**
 * Render a library_persons.raw_data blob (or any flat key/value object) as a
 * readable form-response sheet. Long answers wrap to full width; short
 * answers sit in two-column rows. Empty answers are shown muted as "—".
 *
 * Works in both the dark admin theme (default) and the light print view
 * (pass variant="light").
 */
export function CsvSheet({
  raw,
  variant = "dark",
}: {
  raw: Record<string, unknown> | null | undefined;
  variant?: "dark" | "light";
}) {
  const entries = toSheetEntries(raw);
  if (entries.length === 0) {
    return (
      <p
        className={
          variant === "light"
            ? "text-sm italic text-slate-500"
            : "text-sm italic text-muted-foreground"
        }
      >
        No form responses captured.
      </p>
    );
  }

  const isLight = variant === "light";
  const cardBorder = isLight ? "border-slate-200" : "border";
  const labelClass = isLight
    ? "text-[11px] uppercase tracking-wide text-slate-500 font-semibold"
    : "text-[11px] uppercase tracking-wide text-muted-foreground font-semibold";
  const valueClass = isLight ? "text-sm text-slate-900" : "text-sm text-foreground";
  const emptyClass = isLight ? "text-sm italic text-slate-400" : "text-sm italic text-muted-foreground";

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className={`rounded-md border ${cardBorder} px-3 py-2 ${
            entry.long ? "block" : "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-1 sm:gap-3 items-baseline"
          }`}
        >
          <div className={labelClass}>{entry.label}</div>
          {entry.value ? (
            <div className={`${valueClass} ${entry.long ? "mt-1 whitespace-pre-wrap" : ""}`}>
              {entry.value}
            </div>
          ) : (
            <div className={emptyClass}>—</div>
          )}
        </div>
      ))}
    </div>
  );
}
