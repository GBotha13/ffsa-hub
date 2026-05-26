"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

const BATCH_SIZE = 200;

// Same column-guesser used in the main importer. Kept inline so this
// reconstruction form can be dropped on its own.
function guessField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const map: Record<string, string> = {
    first_name: "first_name",
    firstname: "first_name",
    given_name: "first_name",
    last_name: "last_name",
    lastname: "last_name",
    surname: "last_name",
    family_name: "last_name",
    email: "email",
    email_address: "email",
    e_mail: "email",
    phone: "phone",
    phone_number: "phone",
    mobile: "phone",
    cell: "phone",
  };
  return map[h] ?? "";
}

export function ReconstructErrorsForm({ importId }: { importId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    setProgress(null);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      complete: async (result) => {
        const headers = (result.meta.fields ?? []).filter(Boolean);
        // Auto-map for the minimal fields we need.
        const reverse: Record<string, string> = {};
        for (const h of headers) {
          const target = guessField(h);
          if (target) reverse[target] = h;
        }
        if (!reverse.email && !reverse.phone) {
          setBusy(false);
          setMsg(
            "Couldn't find an Email or Phone column — make sure you uploaded the original CSV."
          );
          return;
        }

        const rows = result.data.map((row) => ({
          first_name: reverse.first_name ? row[reverse.first_name] ?? null : null,
          last_name: reverse.last_name ? row[reverse.last_name] ?? null : null,
          email: reverse.email ? row[reverse.email] ?? null : null,
          phone: reverse.phone ? row[reverse.phone] ?? null : null,
        }));

        let totalReconstructed = 0;
        let totalAlreadyLanded = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const res = await fetch(
            `/api/contacts/imports/${importId}/reconstruct`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rows: batch, batchOffset: i }),
            }
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setBusy(false);
            setMsg(body.error ?? "Reconstruction failed");
            return;
          }
          const body = await res.json();
          totalReconstructed += body.reconstructed ?? 0;
          totalAlreadyLanded += body.alreadyLanded ?? 0;
          setProgress({ done: i + batch.length, total: rows.length });
        }
        setBusy(false);
        setMsg(
          `Done — recovered ${totalReconstructed} lost error rows. ${totalAlreadyLanded} rows had already landed.`
        );
        setTimeout(() => router.refresh(), 1500);
      },
      error: (err) => {
        setBusy(false);
        setMsg(`CSV parse failed: ${err.message}`);
      },
    });
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        disabled={busy}
        className="text-sm file:mr-3 file:rounded file:border file:border-border file:bg-muted file:px-3 file:py-1 file:text-sm file:text-foreground hover:file:bg-muted/80"
      />
      {progress && (
        <p className="text-xs text-muted-foreground mt-2">
          Scanned {progress.done.toLocaleString()} of{" "}
          {progress.total.toLocaleString()} rows
        </p>
      )}
      {msg && <p className="text-sm text-foreground mt-2">{msg}</p>}
    </div>
  );
}
