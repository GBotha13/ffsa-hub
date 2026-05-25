"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  importId: string;
  filename: string;
  importedCount: number;
  matchedCount: number;
  status: string;
};

export function UndoImportButton({
  importId,
  filename,
  importedCount,
  matchedCount,
  status,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already rolled back, or never produced any rows → no action available.
  if (status === "rolled_back") {
    return <span className="text-xs text-gray-400">rolled back</span>;
  }
  if (importedCount === 0 && matchedCount === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  async function handleConfirm() {
    if (confirmText !== "DELETE") {
      setError("Type DELETE to confirm.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/contacts/imports/${importId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Rollback failed");
      setBusy(false);
      return;
    }
    setBusy(false);
    setOpen(false);
    setConfirmText("");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-600 hover:text-red-800 underline"
      >
        Undo
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="bg-white rounded-md max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Undo this import?</h3>
            <p className="text-sm text-gray-700 mb-1">
              File: <span className="font-mono">{filename}</span>
            </p>
            <p className="text-sm text-gray-700 mb-4">
              This will <strong>delete {importedCount.toLocaleString()} contacts</strong>{" "}
              created by this import, and{" "}
              <strong>remove the label from {matchedCount.toLocaleString()} existing contacts</strong>{" "}
              that this import touched.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Field-level enrichment (e.g. a blank city that got filled in) won&apos;t be
              reverted — only the label is removed.
            </p>

            <label className="block text-xs text-gray-600 mb-1">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full mb-3"
              disabled={busy}
              autoFocus
            />

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={busy}
                className="px-3 py-1.5 rounded border text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy || confirmText !== "DELETE"}
                className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:bg-gray-300"
              >
                {busy ? "Rolling back…" : "Yes, undo import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
