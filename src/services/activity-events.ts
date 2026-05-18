import type { TablesInsert, Database } from "@/types/database";

type ActivityEventInsert = TablesInsert<"activity_events">;
type EventType = Database["public"]["Tables"]["activity_events"]["Row"]["event_type"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// Read
// ────────────────────────────────────────────────────────────

export async function getContactActivity(
  supabase: Client,
  contactId: string,
  options?: { limit?: number; offset?: number; eventType?: EventType }
) {
  let query = supabase
    .from("activity_events")
    .select(
      "id, event_type, payload, occurred_at, related_label_id, related_form_id, related_campaign_id, related_user_id, labels(slug, name), forms(slug, name), campaigns(name, subject)",
      { count: "exact" }
    )
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false });

  if (options?.eventType) {
    query = query.eq("event_type", options.eventType);
  }

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}

// ────────────────────────────────────────────────────────────
// Write
// ------------------------------------------------------------
// All inserts go through here. The 043 trigger updates
// contacts.last_interaction_at automatically.
// ────────────────────────────────────────────────────────────

export async function logActivity(supabase: Client, event: ActivityEventInsert) {
  return supabase.from("activity_events").insert(event).select().single();
}

export async function logContactCreated(
  supabase: Client,
  args: { contactId: string; source?: string | null; userId?: string | null }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "contact_created",
    payload: { source: args.source ?? null },
    related_user_id: args.userId ?? null,
  });
}

export async function logLabelAdded(
  supabase: Client,
  args: {
    contactId: string;
    labelId: string;
    addedVia: string;
    userId?: string | null;
  }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "label_added",
    related_label_id: args.labelId,
    related_user_id: args.userId ?? null,
    payload: { added_via: args.addedVia },
  });
}

export async function logLabelRemoved(
  supabase: Client,
  args: {
    contactId: string;
    labelId: string;
    userId?: string | null;
    reason?: string | null;
  }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "label_removed",
    related_label_id: args.labelId,
    related_user_id: args.userId ?? null,
    payload: { reason: args.reason ?? null },
  });
}

export async function logFormSubmitted(
  supabase: Client,
  args: {
    contactId: string;
    formId: string;
    submissionId: string;
  }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "form_submitted",
    related_form_id: args.formId,
    payload: { submission_id: args.submissionId },
  });
}

export async function logCsvImported(
  supabase: Client,
  args: {
    contactId: string;
    importId: string;
    labelId?: string | null;
    userId?: string | null;
  }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "csv_imported",
    related_label_id: args.labelId ?? null,
    related_user_id: args.userId ?? null,
    payload: { import_id: args.importId },
  });
}

export async function logNoteAdded(
  supabase: Client,
  args: { contactId: string; note: string; userId: string }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "note_added",
    related_user_id: args.userId,
    payload: { note: args.note },
  });
}

export async function logManualInteraction(
  supabase: Client,
  args: {
    contactId: string;
    kind: string;
    note?: string | null;
    userId: string;
  }
) {
  return logActivity(supabase, {
    contact_id: args.contactId,
    event_type: "manual_interaction",
    related_user_id: args.userId,
    payload: { kind: args.kind, note: args.note ?? null },
  });
}
