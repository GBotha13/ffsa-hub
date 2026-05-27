"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

// Free-form day-first date input.
// - Display / typing format: DD/MM/YYYY (also accepts DD/MM/YY)
// - Stored value (onChange payload): ISO YYYY-MM-DD, or "" while incomplete
// - No min/max constraints, no native picker — designed for birthdays and
//   expiry dates where the OS date picker is hostile (far-past / far-future).

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function displayToIso(display: string): string {
  const m = display.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return "";
  const dN = parseInt(m[1], 10);
  const mN = parseInt(m[2], 10);
  let yN = parseInt(m[3], 10);
  if (m[3].length === 2) yN = yN < 30 ? 2000 + yN : 1900 + yN;
  if (mN < 1 || mN > 12 || dN < 1 || dN > 31) return "";
  const dd = String(dN).padStart(2, "0");
  const mm = String(mN).padStart(2, "0");
  const yyyy = String(yN).padStart(4, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function autoFormat(input: string): string {
  // Allow only digits and slashes.
  const cleaned = input.replace(/[^\d/]/g, "");

  // Split on user-typed slashes, then distribute characters across the
  // day / month / year buckets (capped at 2/2/4). Overflow from one bucket
  // spills into the next AND is what we use to decide whether to auto-insert
  // a slash — so typing all 8 digits straight, or typing "28/082026", or
  // typing "28/8/2026" all reconstruct to the right shape.
  const userSegments = cleaned.split("/");
  let day = "";
  let month = "";
  let year = "";
  let bucket: 0 | 1 | 2 = 0;
  let overflowedToMonth = false;
  let overflowedToYear = false;

  for (let i = 0; i < userSegments.length; i++) {
    let chars = userSegments[i];
    while (chars.length > 0 && bucket <= 2) {
      const capacity =
        bucket === 0 ? 2 - day.length
        : bucket === 1 ? 2 - month.length
        : 4 - year.length;
      if (capacity === 0) {
        if (bucket === 0) overflowedToMonth = true;
        else if (bucket === 1) overflowedToYear = true;
        bucket = (bucket + 1) as 0 | 1 | 2;
        continue;
      }
      const take = chars.slice(0, capacity);
      chars = chars.slice(capacity);
      if (bucket === 0) day += take;
      else if (bucket === 1) month += take;
      else year += take;
    }
    if (i < userSegments.length - 1) {
      bucket = Math.min(bucket + 1, 2) as 0 | 1 | 2;
    }
  }

  let result = day;
  const showFirstSlash = userSegments.length >= 2 || overflowedToMonth;
  if (showFirstSlash) result += "/" + month;
  const showSecondSlash = userSegments.length >= 3 || overflowedToYear;
  if (showSecondSlash) result += "/" + year;
  return result;
}

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onChange: (isoOrEmpty: string) => void;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, className, placeholder = "DD/MM/YYYY", ...rest }, ref) => {
    const [display, setDisplay] = React.useState<string>(() => isoToDisplay(value));

    React.useEffect(() => {
      const next = isoToDisplay(value);
      setDisplay((cur) => {
        if (next === "" && displayToIso(cur) === "") return cur;
        if (cur && next && displayToIso(cur) === value) return cur;
        return next;
      });
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const formatted = autoFormat(e.target.value);
      setDisplay(formatted);
      onChange(displayToIso(formatted));
    }

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={10}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...rest}
      />
    );
  }
);
DateInput.displayName = "DateInput";
