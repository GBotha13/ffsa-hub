import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/require-permission";
import { getPerson, getRecordsForPerson } from "@/services/records-library";
import { CsvSheet } from "@/components/csv-sheet";
import { bestPersonName } from "@/lib/person-name";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PrintablePersonSheet({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireModuleAccess(supabase, user.id, "records-library");

  const { data: person } = await getPerson(supabase, id);
  if (!person) notFound();

  const records = await getRecordsForPerson(supabase, id);

  const fullName = bestPersonName(person);

  const linkedUser = person.users;
  const linkedUserName = linkedUser
    ? [linkedUser.first_name, linkedUser.last_name].filter(Boolean).join(" ") ||
      linkedUser.email
    : null;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#ffffff",
        color: "#0f172a",
        colorScheme: "light",
      }}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 18mm; }
          body { background: #ffffff !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Print bar — hidden when printing */}
        <div className="no-print flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            FFSA Hub · Records Library
          </p>
          <PrintButton />
        </div>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">{fullName}</h1>
          <p className="text-sm text-slate-600">
            {person.email ?? "no email on file"}
            {person.date_of_birth ? ` · DOB ${person.date_of_birth}` : ""}
            {person.phone ? ` · ${person.phone}` : ""}
          </p>
          {(person.nationality || person.country) && (
            <p className="text-sm text-slate-600 mt-1">
              {[person.nationality, person.country].filter(Boolean).join(" · ")}
            </p>
          )}
        </header>

        {/* Linked user */}
        <section className="mb-8">
          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
              Linked user
            </div>
            {linkedUserName ? (
              <div className="text-sm text-slate-900">
                <span className="font-medium">{linkedUserName}</span>
                {linkedUser?.email && linkedUser.email !== linkedUserName ? (
                  <span className="text-slate-500"> · {linkedUser.email}</span>
                ) : null}
                <div className="text-xs text-slate-500 mt-1">
                  Linked via {person.link_method ?? "—"}
                  {person.linked_at
                    ? ` on ${new Date(person.linked_at).toLocaleString()}`
                    : ""}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Not yet linked to a user account.
              </p>
            )}
          </div>
        </section>

        {/* Records summary */}
        {(records.applications.length > 0 ||
          records.payments.length > 0 ||
          records.enrollments.length > 0 ||
          records.documents.length > 0) && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-3">
              Records on file
            </h2>
            <ul className="space-y-3 text-sm text-slate-800">
              {records.applications.length > 0 && (
                <li>
                  <div className="font-semibold text-slate-700 mb-1">
                    Applications ({records.applications.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {records.applications.map((r: ApplicationRow) => (
                      <li key={r.id}>
                        {[r.program_name, r.cohort, r.status]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {r.submitted_at
                          ? ` · submitted ${new Date(r.submitted_at).toLocaleDateString()}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              {records.enrollments.length > 0 && (
                <li>
                  <div className="font-semibold text-slate-700 mb-1">
                    Enrollments ({records.enrollments.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {records.enrollments.map((r: EnrollmentRow) => (
                      <li key={r.id}>
                        {[r.school_name, r.program_name, r.role]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {r.start_date ? ` · ${r.start_date}` : ""}
                        {r.end_date ? `–${r.end_date}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              {records.payments.length > 0 && (
                <li>
                  <div className="font-semibold text-slate-700 mb-1">
                    Payments ({records.payments.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {records.payments.map((r: PaymentRow) => (
                      <li key={r.id}>
                        {r.amount?.toLocaleString() ?? "—"} {r.currency ?? ""} ·{" "}
                        {r.description ?? "—"}
                        {r.paid_at ? ` · paid ${r.paid_at}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
              {records.documents.length > 0 && (
                <li>
                  <div className="font-semibold text-slate-700 mb-1">
                    Documents ({records.documents.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {records.documents.map((r: DocumentRow) => (
                      <li key={r.id}>
                        {r.doc_type ?? "—"}
                        {r.identifier ? ` · ${r.identifier}` : ""}
                        {r.expires_at ? ` · expires ${r.expires_at}` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Form responses */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            Form responses
          </h2>
          <CsvSheet raw={person.raw_data} variant="light" />
        </section>

        <footer className="mt-12 pt-4 border-t border-slate-200 text-xs text-slate-400">
          Generated {new Date().toLocaleString()} · FFSA Hub
        </footer>
      </div>
    </div>
  );
}

type ApplicationRow = {
  id: string;
  program_name: string | null;
  cohort: string | null;
  status: string | null;
  submitted_at: string | null;
};
type PaymentRow = {
  id: string;
  amount: number | null;
  currency: string | null;
  description: string | null;
  paid_at: string | null;
};
type EnrollmentRow = {
  id: string;
  school_name: string | null;
  program_name: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
};
type DocumentRow = {
  id: string;
  doc_type: string | null;
  identifier: string | null;
  expires_at: string | null;
};
