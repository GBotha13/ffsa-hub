import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { getUserById } from "@/services/users";
import {
  getPermissions,
  getUserPermissions,
  getScopeOptions,
} from "@/services/permissions";
import { getUserHistory } from "@/services/records-library";
import { getSchoolsManageScopes } from "@/lib/auth/schools-manage-scopes";
import { PermissionManager } from "./permission-manager";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  // Access tiers:
  //   super_admin → full editor (status, job title, all modules, all scopes)
  //   schools.manage holder → restricted editor (only `schools.assignable_as_contact`,
  //     only on the programs they manage)
  //   anyone else → kicked back to dashboard
  const { data: superCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .eq("roles.name", "super_admin")
    .limit(1);
  const isSuperAdmin = (superCheck?.length ?? 0) > 0;

  const manageScopes = isSuperAdmin
    ? { hasGlobal: true, programIds: [] }
    : await getSchoolsManageScopes(supabase, authUser.id);

  const hasAnySchoolsManage =
    manageScopes.hasGlobal || manageScopes.programIds.length > 0;

  if (!isSuperAdmin && !hasAnySchoolsManage) redirect("/dashboard");

  // Load the target user
  const { data: targetUser, error } = await getUserById(supabase, id);
  if (error || !targetUser) notFound();

  // Load all permissions, user's current permissions, and scope options
  const [permissionsByModule, userPermissions, scopeOptions] = await Promise.all([
    getPermissions(supabase),
    getUserPermissions(supabase, id),
    getScopeOptions(supabase),
  ]);

  // Records Library: every library_person linked to this user + their
  // aggregated applications / payments / enrollments / documents.
  // Uses admin client because RLS lets users only see their own linked
  // records — staff viewing another user need the bypass.
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  const [linkedPersonsRes, history] = await Promise.all([
    adminAny
      .from("library_persons")
      .select("id, first_name, last_name, email, date_of_birth, link_method, linked_at")
      .eq("linked_user_id", id)
      .order("linked_at", { ascending: false }),
    getUserHistory(admin, id),
  ]);
  const linkedPersons: LinkedPerson[] = linkedPersonsRes.data ?? [];
  const totalRecords =
    history.applications.length +
    history.payments.length +
    history.enrollments.length +
    history.documents.length;

  const name =
    targetUser.display_name ??
    (targetUser.first_name
      ? `${targetUser.preferred_name ?? targetUser.first_name} ${targetUser.last_name}`
      : targetUser.email ?? "Unknown User");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="page-eyebrow">SYSTEM ACCESS</p>
        <h1 className="page-title">{name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {targetUser.email} ·{" "}
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: "4px",
              background:
                targetUser.status === "active"
                  ? "hsl(142 60% 20%)"
                  : targetUser.status === "pending_approval"
                  ? "hsl(42 80% 18%)"
                  : "hsl(22 8% 15%)",
              color:
                targetUser.status === "active"
                  ? "hsl(142 60% 55%)"
                  : targetUser.status === "pending_approval"
                  ? "hsl(42 95% 55%)"
                  : "hsl(30 8% 55%)",
            }}
          >
            {targetUser.status === "active"
              ? "Active"
              : targetUser.status === "pending_approval"
              ? "Pending Approval"
              : "Invited"}
          </span>
        </p>
      </div>

      <PermissionManager
        userId={id}
        currentStatus={targetUser.status ?? "invited"}
        currentJobTitle={targetUser.job_title ?? ""}
        permissionsByModule={permissionsByModule}
        userPermissions={userPermissions}
        scopeOptions={scopeOptions}
        isSuperAdmin={isSuperAdmin}
        managedProgramIds={
          manageScopes.hasGlobal
            ? null // null sentinel = all programs
            : manageScopes.programIds
        }
      />

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="page-eyebrow">RECORDS ON FILE</p>
            <h2 className="text-lg font-semibold">
              History from past CSV imports
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalRecords} record{totalRecords === 1 ? "" : "s"} ·{" "}
            {linkedPersons.length} library person
            {linkedPersons.length === 1 ? "" : "s"} linked
          </p>
        </div>

        {linkedPersons.length === 0 && totalRecords === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No CSV-imported records linked to this user yet. Upload historical
            data via{" "}
            <Link href="/records-library" className="underline">
              Records Library
            </Link>{" "}
            — matching engine attaches records by email + last name on signup.
          </div>
        ) : null}

        {linkedPersons.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Linked library person record{linkedPersons.length === 1 ? "" : "s"}
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
                    className="flex flex-wrap items-center gap-3 justify-between px-3 py-2.5 text-sm"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        {lp.email ?? "no email"}
                        {lp.date_of_birth ? ` · DOB ${lp.date_of_birth}` : ""}
                        {lp.link_method ? ` · linked via ${lp.link_method}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={`/records-library/persons/${lp.id}`}
                        className="px-2.5 py-1 text-xs border rounded-md hover:bg-muted"
                      >
                        Open profile
                      </Link>
                      <Link
                        href={`/print/records-library/persons/${lp.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-md hover:bg-muted"
                      >
                        <Printer className="h-3 w-3" />
                        Print sheet
                      </Link>
                    </div>
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
          >
            {history.applications.map((r: ApplicationRow) => (
              <li key={r.id} className="py-2 border-t first:border-t-0">
                <div className="font-medium text-sm">
                  {r.program_name ?? "Application"}
                </div>
                <div className="text-xs text-muted-foreground">
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
          >
            {history.enrollments.map((r: EnrollmentRow) => (
              <li key={r.id} className="py-2 border-t first:border-t-0">
                <div className="font-medium text-sm">
                  {r.school_name ?? r.program_name ?? "Enrollment"}
                </div>
                <div className="text-xs text-muted-foreground">
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
          >
            {history.payments.map((r: PaymentRow) => (
              <li key={r.id} className="py-2 border-t first:border-t-0">
                <div className="font-medium text-sm">
                  {r.amount != null
                    ? `${r.currency ?? ""} ${r.amount.toLocaleString()}`.trim()
                    : "Payment"}
                </div>
                <div className="text-xs text-muted-foreground">
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
          >
            {history.documents.map((r: DocumentRow) => (
              <li key={r.id} className="py-2 border-t first:border-t-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {r.doc_type ?? "Document"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
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
                </div>
              </li>
            ))}
          </RecordList>
        </div>
      </section>
    </div>
  );
}

function RecordList({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="px-3 py-1">
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
