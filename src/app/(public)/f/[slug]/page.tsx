import { createClient } from "@/lib/supabase/server";
import { getFormBySlug } from "@/services/forms";
import { emptyFormSchema, type FormSchema } from "@/lib/forms/schema";
import { FormRuntime } from "./form-runtime";

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Form not available</h1>
          <p className="text-sm text-gray-600 mt-1">
            This form may have closed or the link is incorrect.
          </p>
        </div>
      </div>
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
