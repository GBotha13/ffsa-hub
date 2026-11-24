import { dueBackHint, RETURN_BY } from "@/lib/vehicles/return-day";

/**
 * The due-back rule, beside the "Last day you need it" field on both booking forms
 * (Gideon, 24 Nov 2026: "a small explanation … that will clearly explain this").
 */
export function DueBackNote({
  lastDay,
  plain = false,
  className = "",
}: {
  lastDay: string;
  /** The public request page keeps its own look: no Hub colours. */
  plain?: boolean;
  className?: string;
}) {
  const box = plain ? "border-l-2 border-current" : "border-l-2 border-foreground bg-bone";
  const soft = plain ? "opacity-70" : "text-muted-foreground";
  return (
    <div className={`${box} px-3 py-2 text-xs leading-relaxed ${className}`}>
      <p className="font-semibold">{dueBackHint(lastDay)}</p>
      <p className={`mt-1 ${soft}`}>
        Choose the last day you&apos;ll drive the vehicle. You bring it back the next morning, before {RETURN_BY}:
        washed, with a full tank and the return inspection done. That morning is kept free for you, so you
        don&apos;t need to book it. For example: last day Wednesday, back on Thursday before {RETURN_BY}.
      </p>
      <p className={`mt-1 ${soft}`}>
        Done sooner? Ask the Vehicle Coordinator for an early return.
      </p>
    </div>
  );
}
