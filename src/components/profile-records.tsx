import Link from "next/link";
import {
  Printer,
  FileText,
  GraduationCap,
  Receipt,
  FileBadge,
  Ticket,
  UserCheck,
  ShieldCheck,
  Flame,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getProfileAttachments,
  type AttachmentRow,
} from "@/services/profile-attachments";

/**
 * Shared records-on-file panel for both the admin user profile (/users/[id])
 * and the personal profile (/profile). Reads via the service-role admin
 * client so staff can see another user's records — RLS only lets users
 * read their own linked rows.
 *
 * Combines historical CSV rows (library_*) with everything created in-app:
 * application_responses, enrollments, student_payments, orders/tickets,
 * reference_requests, consent_records, prayer_room_slot_members.
 *
 * `canOpenLibrary` controls whether the linked-source-records list shows
 * "Open record" / "Print sheet" deep-links to the records-library. Self-view
 * sets this false; admin view sets it true.
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

  const [linkedPersonsRes, attachments] = await Promise.all([
    adminAny
      .from("library_persons")
      .select(
        "id, first_name, last_name, email, date_of_birth, link_method, linked_at, source_import_id"
      )
      .eq("linked_user_id", userId)
      .order("linked_at", { ascending: false }),
    getProfileAttachments(admin, userId),
  ]);
  const linkedPersons: LinkedPerson[] = linkedPersonsRes.data ?? [];

  const total =
    attachments.applications.length +
    attachments.enrollments.length +
    attachments.payments.length +
    attachments.tickets.length +
    attachments.documents.length +
    attachments.references.length +
    attachments.consents.length +
    attachments.prayerRoom.length;

  if (linkedPersons.length === 0 && total === 0) {
    return (
      <div className="rounded-xl border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {canOpenLibrary
            ? "Nothing on file yet. Records will appear here as the user submits applications, makes payments, attends events, etc., or when staff upload historical CSVs."
            : "Nothing on file yet. Applications, payments, tickets and other records you create in FFSA Hub will appear here automatically."}
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
          value={attachments.applications.length}
          icon={FileText}
          tint="blue"
        />
        <BigStat
          label="Enrollments"
          value={attachments.enrollments.length}
          icon={GraduationCap}
          tint="emerald"
        />
        <BigStat
          label="Payments"
          value={attachments.payments.length}
          icon={Receipt}
          tint="amber"
        />
        <BigStat
          label="Tickets"
          value={attachments.tickets.length}
          icon={Ticket}
          tint="violet"
        />
      </div>

      {linkedPersons.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="bg-muted/50 px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Linked CSV source record{linkedPersons.length === 1 ? "" : "s"}
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
                      {lp.link_method ? ` · linked via ${lp.link_method}` : ""}
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
        <Section
          title="Applications"
          empty="No applications on file."
          rows={attachments.applications}
          icon={FileText}
        />
        <Section
          title="Enrollments"
          empty="No enrollments on file."
          rows={attachments.enrollments}
          icon={GraduationCap}
        />
        <Section
          title="Payments"
          empty="No payments on file."
          rows={attachments.payments}
          icon={Receipt}
        />
        <Section
          title="Event tickets"
          empty="No event tickets on file."
          rows={attachments.tickets}
          icon={Ticket}
        />
        <Section
          title="Documents"
          empty="No documents on file."
          rows={attachments.documents}
          icon={FileBadge}
        />
        <Section
          title="References"
          empty="No references requested or submitted."
          rows={attachments.references}
          icon={UserCheck}
        />
        <Section
          title="Consents"
          empty="No agreements accepted yet."
          rows={attachments.consents}
          icon={ShieldCheck}
        />
        <Section
          title="Prayer room"
          empty="No prayer-room slots signed up to."
          rows={attachments.prayerRoom}
          icon={Flame}
        />
      </div>
    </div>
  );
}

function Section({
  title,
  empty,
  rows,
  icon: Icon,
}: {
  title: string;
  empty: string;
  rows: AttachmentRow[];
  icon: React.ComponentType<{ className?: string }>;
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
          {rows.length}
        </span>
      </div>
      <div className="px-4 py-1">
        {rows.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground italic">{empty}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2.5 border-t first:border-t-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      <span className="capitalize">{r.title}</span>
                      <SourceBadge source={r.source} />
                    </div>
                    {r.subtitle && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {r.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 text-right">
                    {r.date ? (
                      <>
                        {r.dateLabel && (
                          <div className="text-[10px] uppercase tracking-wide opacity-70">
                            {r.dateLabel}
                          </div>
                        )}
                        <div>{formatDate(r.date)}</div>
                      </>
                    ) : null}
                  </div>
                </div>
                {r.fileUrl && (
                  <div className="mt-1.5">
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline text-blue-400"
                    >
                      Open file →
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: "csv" | "app" }) {
  const isCsv = source === "csv";
  return (
    <span
      className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${
        isCsv
          ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
          : "bg-blue-500/10 text-blue-300 border-blue-500/30"
      }`}
      title={isCsv ? "Imported from CSV upload" : "Created in-app"}
    >
      {isCsv ? "Imported" : "In-app"}
    </span>
  );
}

function formatDate(iso: string): string {
  // Cheap human format. Times of day collapse to date only.
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
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
