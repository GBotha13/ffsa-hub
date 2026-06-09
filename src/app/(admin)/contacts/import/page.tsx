import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireModuleAccess } from "@/lib/require-permission";
import { getCachedActiveLabels } from "@/lib/cached-reads";
import { listCsvImports } from "@/services/csv-imports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvImportForm } from "./csv-import-form";
import { UndoImportButton } from "./undo-import-button";

export default async function ContactsImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "contacts");

  const labelsResult = await getCachedActiveLabels();
  const importsResult = await listCsvImports(supabase, { limit: 10 });

  const labels = labelsResult.data ?? [];
  const recentImports = importsResult.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Import contacts from CSV</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV of contacts, pick a label to apply to every row, and the system
          will dedupe by email or phone as it imports.
        </p>
      </div>

      <CsvImportForm labels={labels} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent imports</h2>
        {recentImports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No imports yet.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Matched</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                  <TableHead className="text-right">Errored</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentImports.map((row: ImportRow) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.filename}</TableCell>
                    <TableCell>
                      {row.labels?.name ?? row.custom_label_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.row_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.imported_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.matched_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.review_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.error_count > 0 ? (
                        <Link
                          href={`/contacts/imports/${row.id}/errors`}
                          className="text-red-400 hover:text-red-300 hover:underline"
                        >
                          {row.error_count.toLocaleString()}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <UndoImportButton
                        importId={row.id}
                        filename={row.filename}
                        importedCount={row.imported_count}
                        matchedCount={row.matched_count}
                        status={row.status}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : status === "processing" || status === "pending"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
      : status === "failed"
      ? "bg-red-500/15 text-red-400 border-red-500/20"
      : status === "rolled_back"
      ? "bg-muted text-muted-foreground border-border"
      : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
