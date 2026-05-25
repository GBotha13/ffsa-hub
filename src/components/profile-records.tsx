import Link from "next/link";
import { Printer, FileText, GraduationCap, Receipt, FileBadge } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserHistory } from "@/services/records-library";

/**
 * Shared records-on-file panel used on both the admin user profile
 * (/users/[id]) and the personal profile (/profile). Reads via the
 * service-role admin client because RLS only lets a user read their
 * own linked rows — staff need the bypass to view another user's
 * records.
 *
 * `canOpenLibrary` controls whether the "Open profile" / "Print sheet"
 * deep links to the records-library are rendered. Self-view sets this
 * false; admin view sets it true.
 */
export async function ProfileRecords({
  userId,
  canOpenLibrary,
}: {
  userId: string;
  canOpenLibrary: boolean;
}) {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  const [linkedPersonsRes, history] = await Promise.all([
    adminAny
      .from("library_persons")
      .select(
        "id, first_name, last_name, email, date_of_birth, link_method, linked_at, source_import_id"
      )
      .eq("linked_user_id", userId)
      .order("linked_at", { ascending: false }),
    getUserHistory(admin, userId),
  ]);
  const linkedPersons: LinkedPerson[] = linkedPersonsRes.data ?? [];
  const totalRecords =
    history.applications.length +
    history.payments.length +
    history.enrollments.length +
    history.documents.length;

  if (linkedPersons.length === 0 && totalRecords === 0) {
    return (
      <div className="rounded-xl border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {canOpenLibrary
            ? "No CSV-imported records linked to this user yet."
            : "Nothing on file yet. If you've previously applied to FFSA, staff will link your history here."}
        </p>
        {canOpenLibrary && (
          <Link
            href="/records-library"
            className="inline-block mt-3 text-xs underline text-muted-foreground hover:text-foreground"
          >
            Go to Records Library →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <BigStat
          label="Applications"
          value={history.applications.length}
          icon={FileText}
          tint="blue"
        />
        <BigStat
          label="Enrollments"
          value={history.enrollments.length}
          icon={GraduationCap}
          tint="emerald"
        />
        <BigStat
          label="Payments"
          value={history.payments.length}
          icon={Receipt}
          tint="amber"
        />
        <BigStat
          label="Documents"
          value={history.documents.length}
          icon={FileBadge}
          tint="violet"
        />
      </div>

      {linkedPersons.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="bg-muted/50 px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Source records
          </div>
          <div className="divide-y">
            {linkedPersons.map((lp) => {
              const name =
                [lp.first_name, lp.last_name].filter(Boolean).join(" ") ||
                lp.email ||
                "—";
              return (
                <div
                  key={lp.id}
                  className="flex flex-wrap items-center gap-3 justify-between px-4 py-3 text-sm"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {lp.email ?? "no email"}
                      {lp.date_of_birth ? ` · DOB ${lp.date_of_birth}` : ""}
                      {lp.link_method
                        ? ` · linked via ${lp.link_method}`
                        : ""}
                    </div>
                  </div>
                  {canOpenLibrary && (
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={`/records-library/persons/${lp.id}`}
                        className="px-2.5 py-1 text-xs border rounded-md hover:bg-muted"
                      >
                        Open record
                      </Link>
                      <Link
                        href={`/print/records-library/persons/${lp.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-md hover:bg-muted"
                      >
                        <Printer className="h-3 w-3" />
                        Print
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RecordList
          title="Applications"
          empty="No applications on file."
          count={history.applications.length}
          icon={FileText}
        >
          {history.applications.map((r: ApplicationRow) => (
            <li key={r.id} className="py-2.5 border-t first:border-t-0">
              <div className="font-medium text-sm">
                {r.program_name ?? "Application"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {[r.cohort, r.status].filter(Boolean).join(" · ") || "—"}
                {r.submitted_at
                  ? ` · submitted ${new Date(r.submitted_at).toLocaleDateString()}`
                  : ""}
              </div>
            </li>
          ))}
        </RecordList>

        <RecordList
          title="Enrollments"
          empty="No enrollments on file."
          count={history.enrollments.length}
          icon={GraduationCap}
        >
          {history.enrollments.map((r: EnrollmentRow) => (
            <li key={r.id} className="py-2.5 border-t first:border-t-0">
              <div className="font-medium text-sm">
                {r.school_name ?? r.program_name ?? "Enrollment"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {[r.program_name, r.role].filter(Boolean).join(" · ") || "—"}
                {r.start_date || r.end_date
                  ? ` · ${r.start_date ?? "?"} → ${r.end_date ?? "?"}`
                  : ""}
              </div>
            </li>
          ))}
        </RecordList>

        <RecordList
          title="Payments"
          empty="No payments on file."
          count={history.payments.length}
          icon={Receipt}
        >
          {history.payments.map((r: PaymentRow) => (
            <li key={r.id} className="py-2.5 border-t first:border-t-0">
              <div className="font-medium text-sm">
                {r.amount != null
                  ? `${r.currency ?? ""} ${r.amount.toLocaleString()}`.trim()
                  : "Payment"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {r.description ?? "—"}
                {r.paid_at ? ` · paid ${r.paid_at}` : ""}
              </div>
            </li>
          ))}
        </RecordList>

        <RecordList
          title="Documents"
          empty="No documents on file."
          count={history.documents.length}
          icon={FileBadge}
        >
          {history.documents.map((r: DocumentRow) => (
            <li
              key={r.id}
              className="py-2.5 border-t first:border-t-0 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">
                  {r.doc_type ?? "Document"}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {r.identifier ?? "—"}
                  {r.expires_at ? ` · expires ${r.expires_at}` : ""}
                </div>
              </div>
              {r.file_url ? (
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline text-blue-400 shrink-0"
                >
                  Open
                </a>
              ) : null}
            </li>
          ))}
        </RecordList>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tint: "blue" | "emerald" | "amber" | "violet";
}) {
  const tints = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-300",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  } as const;
  return (
    <div className={`rounded-xl border p-4 ${tints[tint]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-3xl font-bold tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function RecordList({
  title,
  empty,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {title}
          </span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
      <div className="px-4 py-1">
        {count === 0 ? (
          <p className="py-3 text-sm text-muted-foreground italic">{empty}</p>
        ) : (
          <ul className="divide-y">{children}</ul>
        )}
      </div>
    </div>
  );
}

type LinkedPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  date_of_birth: string | null;
  link_method: string | null;
  linked_at: string | null;
  source_import_id: string | null;
};

type ApplicationRow = {
  id: string;
  program_name: string | null;
  cohort: string | null;
  status: string | null;
  submitted_at: string | null;
};

type EnrollmentRow = {
  id: string;
  school_name: string | null;
  program_name: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
};

type PaymentRow = {
  id: string;
  amount: number | null;
  currency: string | null;
  description: string | null;
  paid_at: string | null;
};

type DocumentRow = {
  id: string;
  doc_type: string | null;
  identifier: string | null;
  expires_at: string | null;
  file_url: string | null;
};
