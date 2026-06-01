import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getFormById, listFormSubmissions } from "@/services/forms";
import { fieldKey, type FormSchema, type FormField } from "@/lib/forms/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Per-form responses: every submission with the resolved contact + all answers.
export default async function FormResponsesPage({
  params,
}: {
  params: Promise<{ id: string; formId: string }>;
}) {
  const { id: eventId, formId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: form, error } = await getFormById(supabase, formId);
  if (error || !form) notFound();

  const { data: submissions } = await listFormSubmissions(supabase, formId);

  const schema: FormSchema | null =
    form.schema && typeof form.schema === "object" && "steps" in form.schema
      ? (form.schema as unknown as FormSchema)
      : null;
  const fields: FormField[] = schema
    ? schema.steps.flatMap((s) => s.fields).filter((f) => f.type !== "consent")
    : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (submissions ?? []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/events/${eventId}/forms/${formId}`}
          className="text-xs text-muted-foreground hover:text-foreground uppercase"
          style={{ letterSpacing: "0.15em" }}
        >
          ← Edit form
        </Link>
        <Link
          href={`/events/${eventId}?tab=forms`}
          className="text-xs text-muted-foreground hover:text-foreground uppercase"
          style={{ letterSpacing: "0.15em" }}
        >
          Event →
        </Link>
      </div>

      <div>
        <p className="page-eyebrow">FORM RESPONSES</p>
        <h1 className="page-title">{form.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length} submission{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No submissions yet. Responses appear here as people fill in the form.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((sub) => {
            const c = sub.contacts;
            const name = c
              ? `${c.preferred_name ?? c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                "—"
              : "(unresolved contact)";
            const raw = (sub.raw_data ?? {}) as Record<string, unknown>;
            return (
              <Card key={sub.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        {c?.id ? (
                          <Link
                            href={`/contacts/${c.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[c?.email, c?.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant={
                          sub.dedup_action === "queued_for_review"
                            ? "outline"
                            : "secondary"
                        }
                        className="capitalize"
                      >
                        {sub.dedup_action === "queued_for_review"
                          ? "Needs review"
                          : sub.dedup_action === "new"
                            ? "New contact"
                            : "Matched"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(sub.submitted_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {fields.map((f) => (
                      <div key={f.id} className="text-sm">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {f.label}
                        </dt>
                        <dd className="mt-0.5">{formatAnswer(f, raw)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatAnswer(field: FormField, raw: Record<string, unknown>): string {
  const v = raw[fieldKey(field)];
  if (field.type === "outcome" || field.type === "checkbox") {
    return v === true ? "✓ Yes" : "—";
  }
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
