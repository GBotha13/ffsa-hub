"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-700"
    >
      <Printer className="h-4 w-4" />
      Print / Save as PDF
    </button>
  );
}
