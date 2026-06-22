"use client";

import { countries } from "@/lib/countries";

// Plain-state country <select> (the shared CountrySelect is react-hook-form
// bound; the vehicle forms use useState). Value is the ISO-2 code, which
// getXeroRegionForStudent maps to the Xero org (US → US, else → SA).
export function CountryPicker({
  value,
  onChange,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      }
    >
      <option value="">Select country…</option>
      {countries.map((c) => (
        <option key={c.iso2} value={c.iso2}>
          {c.flag} {c.name}
        </option>
      ))}
    </select>
  );
}
