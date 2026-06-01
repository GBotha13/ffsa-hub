import { createClient } from "@/lib/supabase/server";
import { getFormBySlug } from "@/services/forms";
import { emptyFormSchema, type FormSchema } from "@/lib/forms/schema";
import { FormRuntime } from "./form-runtime";
import { PublicFormNotice } from "@/components/public-form-shell";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: form } = await getFormBySlug(supabase, slug);

  if (!form || !form.is_active) {
    return (
      <PublicFormNotice
        heading="Form not available"
        body="This form may have closed or the link is incorrect. Please check with the sender for an updated link."
      />
    );
  }

  const schema: FormSchema =
    form.schema && typeof form.schema === "object" && "steps" in form.schema
      ? (form.schema as unknown as FormSchema)
      : emptyFormSchema();

  const eventLogoUrl =
    form.events && typeof form.events === "object" && "logo_url" in form.events
      ? ((form.events as { logo_url: string | null }).logo_url ?? null)
      : null;

  return (
    <FormRuntime
      slug={slug}
      schema={schema}
      formName={form.name}
      eventLogoUrl={eventLogoUrl}
    />
  );
}
