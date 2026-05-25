import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { getLabels } from "@/services/labels";
import { listCsvImports } from "@/services/csv-imports";
import { CsvImportForm } from "./csv-import-form";
import { UndoImportButton } from "./undo-import-button";

export default async function ContactsImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "contacts");

  const labelsResult = await getLabels(supabase, { active: true });
  const importsResult = await listCsvImports(supabase, { limit: 10 });

  const labels = labelsResult.data ?? [];
  const recentImports = importsResult.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Import contacts from CSV</h1>
        <p className="text-sm text-gray-600">
          Upload a CSV of contacts, pick a label to apply to every row, and the system
          will dedupe by email or phone as it imports.
        </p>
      </div>

      <CsvImportForm labels={labels} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent imports</h2>
        {recentImports.length === 0 ? (
          <p className="text-sm text-gray-500">No imports yet.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">File</th>
                  <th className="text-left px-3 py-2 font-medium">Label</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium">Rows</th>
                  <th className="text-right px-3 py-2 font-medium">New</th>
                  <th className="text-right px-3 py-2 font-medium">Matched</th>
                  <th className="text-right px-3 py-2 font-medium">Review</th>
                  <th className="text-right px-3 py-2 font-medium">Errored</th>
                  <th className="text-left px-3 py-2 font-medium">When</th>
                  <th className="text-right px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentImports.map((row: ImportRow) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row.filename}</td>
                    <td className="px-3 py-2">{row.labels?.name ?? row.custom_label_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-right">{row.row_count}</td>
                    <td className="px-3 py-2 text-right">{row.imported_count}</td>
                    <td className="px-3 py-2 text-right">{row.matched_count}</td>
                    <td className="px-3 py-2 text-right">{row.review_count}</td>
                    <td className="px-3 py-2 text-right">{row.error_count}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <UndoImportButton
                        importId={row.id}
                        filename={row.filename}
                        importedCount={row.imported_count}
                        matchedCount={row.matched_count}
                        status={row.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type ImportRow = {
  id: string;
  filename: string;
  status: string;
  row_count: number;
  imported_count: number;
  matched_count: number;
  review_count: number;
  error_count: number;
  custom_label_name: string | null;
  created_at: string;
  labels: { slug: string; name: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-green-100 text-green-800"
      : status === "processing" || status === "pending"
      ? "bg-yellow-100 text-yellow-800"
      : status === "failed"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs ${cls}`}>{status}</span>;
}
