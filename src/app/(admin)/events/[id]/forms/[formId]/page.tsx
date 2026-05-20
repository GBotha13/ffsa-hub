import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getFormById } from "@/services/forms";
import { getEventOutcomes } from "@/services/event-outcomes";
import { getLabels } from "@/services/labels";
import { emptyFormSchema, type FormSchema } from "@/lib/forms/schema";
import { FormBuilder } from "./form-builder";

export default async function FormBuilderPage({
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

  const [{ data: outcomes }, { data: labels }] = await Promise.all([
    getEventOutcomes(supabase, eventId),
    getLabels(supabase, { active: true }),
  ]);

  // Stored schema may be an older/empty shape — fall back to a fresh one.
  const schema: FormSchema =
    form.schema && typeof form.schema === "object" && "steps" in form.schema
      ? (form.schema as unknown as FormSchema)
      : emptyFormSchema();

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/events/${eventId}?tab=forms`}
          className="text-xs text-muted-foreground hover:text-foreground uppercase"
          style={{ letterSpacing: "0.15em" }}
        >
          ← Back to event
        </Link>
      </div>
      <FormBuilder
        eventId={eventId}
        form={{
          id: form.id,
          name: form.name,
          slug: form.slug,
          is_active: form.is_active,
          records_attendance: form.records_attendance,
          label_id: form.label_id,
        }}
        initialSchema={schema}
        outcomes={(outcomes ?? []).map(
          (o: { id: string; name: string }) => ({ id: o.id, name: o.name })
        )}
        labels={labels ?? []}
      />
    </div>
  );
}
