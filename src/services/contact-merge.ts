// Service module for merging two contacts.
//
// The TARGET contact survives. The SOURCE contact's identifiers,
// labels, activity, form submissions, campaign recipients,
// unsubscribes, event roles, outcomes, orders, and import-error
// references are re-pointed to the target. The source contact is
// then deleted.
//
// Target-record FIELDS (first_name, email cache, etc.) are NOT
// overwritten — the user picks which contact wins by which one
// they merge INTO. Source's identifiers become secondaries on
// the target.

import { logActivity } from "./activity-events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type MergePreview = {
  sourceId: string;
  targetId: string;
  emails: number;
  phones: number;
  labels: number;
  activityEvents: number;
  formSubmissions: number;
  campaignRecipients: number;
  unsubscribes: number;
  eventRoles: number;
  eventOutcomes: number;
  orders: number;
  importErrors: number;
};

export async function previewMerge(
  supabase: Client,
  sourceId: string,
  targetId: string
): Promise<MergePreview> {
  const counts = await Promise.all([
    countWhere(supabase, "contact_emails", "contact_id", sourceId),
    countWhere(supabase, "contact_phones", "contact_id", sourceId),
    countWhere(supabase, "contact_labels", "contact_id", sourceId),
    countWhere(supabase, "activity_events", "contact_id", sourceId),
    countWhere(supabase, "form_submissions", "contact_id", sourceId),
    countWhere(supabase, "campaign_recipients", "contact_id", sourceId),
    countWhere(supabase, "unsubscribes", "contact_id", sourceId),
    countWhere(supabase, "event_roles", "contact_id", sourceId),
    countWhere(supabase, "event_outcome_responses", "contact_id", sourceId),
    countWhere(supabase, "orders", "buyer_contact_id", sourceId),
    countWhere(supabase, "csv_import_errors", "resolved_contact_id", sourceId),
  ]);
  return {
    sourceId,
    targetId,
    emails: counts[0],
    phones: counts[1],
    labels: counts[2],
    activityEvents: counts[3],
    formSubmissions: counts[4],
    campaignRecipients: counts[5],
    unsubscribes: counts[6],
    eventRoles: counts[7],
    eventOutcomes: counts[8],
    orders: counts[9],
    importErrors: counts[10],
  };
}

export async function mergeContacts(
  supabase: Client,
  args: { sourceId: string; targetId: string; userId: string }
): Promise<{ data: MergePreview | null; error: unknown }> {
  const { sourceId, targetId, userId } = args;

  if (sourceId === targetId) {
    return { data: null, error: new Error("Cannot merge a contact into itself") };
  }

  // 0. Snapshot what's about to move (for the audit event payload).
  const preview = await previewMerge(supabase, sourceId, targetId);

  // 1. Emails — drop source rows whose normalized email already
  //    exists on the target, then demote any remaining source
  //    primaries, then re-point.
  {
    const { data: targetEmails } = await supabase
      .from("contact_emails")
      .select("email_normalized")
      .eq("contact_id", targetId);
    const dupes = Array.from(
      new Set(
        ((targetEmails ?? []) as Array<{ email_normalized: string }>).map(
          (e) => e.email_normalized
        )
      )
    );
    if (dupes.length > 0) {
      await supabase
        .from("contact_emails")
        .delete()
        .eq("contact_id", sourceId)
        .in("email_normalized", dupes);
    }
    await supabase
      .from("contact_emails")
      .update({ is_primary: false })
      .eq("contact_id", sourceId)
      .eq("is_primary", true);
    await supabase
      .from("contact_emails")
      .update({ contact_id: targetId })
      .eq("contact_id", sourceId);
  }

  // 2. Phones — same shape as emails.
  {
    const { data: targetPhones } = await supabase
      .from("contact_phones")
      .select("phone_normalized")
      .eq("contact_id", targetId);
    const dupes = Array.from(
      new Set(
        ((targetPhones ?? []) as Array<{ phone_normalized: string | null }>)
          .map((p) => p.phone_normalized)
          .filter((p): p is string => !!p)
      )
    );
    if (dupes.length > 0) {
      await supabase
        .from("contact_phones")
        .delete()
        .eq("contact_id", sourceId)
        .in("phone_normalized", dupes);
    }
    await supabase
      .from("contact_phones")
      .update({ is_primary: false })
      .eq("contact_id", sourceId)
      .eq("is_primary", true);
    await supabase
      .from("contact_phones")
      .update({ contact_id: targetId })
      .eq("contact_id", sourceId);
  }

  // 3. Labels — UNIQUE(contact_id, label_id) on contact_labels, so
  //    de-dupe before re-pointing.
  {
    const { data: targetLabels } = await supabase
      .from("contact_labels")
      .select("label_id")
      .eq("contact_id", targetId);
    const dupes = Array.from(
      new Set(
        ((targetLabels ?? []) as Array<{ label_id: string }>).map(
          (l) => l.label_id
        )
      )
    );
    if (dupes.length > 0) {
      await supabase
        .from("contact_labels")
        .delete()
        .eq("contact_id", sourceId)
        .in("label_id", dupes);
    }
    await supabase
      .from("contact_labels")
      .update({ contact_id: targetId })
      .eq("contact_id", sourceId);
  }

  // 4. Activity events — no unique constraints, straight re-point.
  await supabase
    .from("activity_events")
    .update({ contact_id: targetId })
    .eq("contact_id", sourceId);

  // 5. Form submissions
  await supabase
    .from("form_submissions")
    .update({ contact_id: targetId })
    .eq("contact_id", sourceId);

  // 6. Campaign recipients — likely has UNIQUE(campaign_id,
  //    contact_id), so de-dupe.
  {
    const { data: targetRecips } = await supabase
      .from("campaign_recipients")
      .select("campaign_id")
      .eq("contact_id", targetId);
    const dupes = Array.from(
      new Set(
        ((targetRecips ?? []) as Array<{ campaign_id: string }>).map(
          (r) => r.campaign_id
        )
      )
    );
    if (dupes.length > 0) {
      await supabase
        .from("campaign_recipients")
        .delete()
        .eq("contact_id", sourceId)
        .in("campaign_id", dupes);
    }
    await supabase
      .from("campaign_recipients")
      .update({ contact_id: targetId })
      .eq("contact_id", sourceId);
  }

  // 7. Unsubscribes — UNIQUE(contact_id, label_id) typically.
  {
    const { data: targetUnsubs } = await supabase
      .from("unsubscribes")
      .select("label_id")
      .eq("contact_id", targetId);
    const dupes = Array.from(
      new Set(
        ((targetUnsubs ?? []) as Array<{ label_id: string | null }>)
          .map((u) => u.label_id)
          .filter((v): v is string => !!v)
      )
    );
    if (dupes.length > 0) {
      await supabase
        .from("unsubscribes")
        .delete()
        .eq("contact_id", sourceId)
        .in("label_id", dupes);
    }
    await supabase
      .from("unsubscribes")
      .update({ contact_id: targetId })
      .eq("contact_id", sourceId);
  }

  // 8. Event roles
  await supabase
    .from("event_roles")
    .update({ contact_id: targetId })
    .eq("contact_id", sourceId);

  // 9. Event outcome responses
  await supabase
    .from("event_outcome_responses")
    .update({ contact_id: targetId })
    .eq("contact_id", sourceId);

  // 10. Orders (buyer_contact_id)
  await supabase
    .from("orders")
    .update({ buyer_contact_id: targetId })
    .eq("buyer_contact_id", sourceId);

  // 11. CSV import errors (resolved_contact_id)
  await supabase
    .from("csv_import_errors")
    .update({ resolved_contact_id: targetId })
    .eq("resolved_contact_id", sourceId);

  // 12. Dedup review queue — both columns
  await supabase
    .from("dedup_review_queue")
    .update({ email_match_contact_id: targetId })
    .eq("email_match_contact_id", sourceId);
  await supabase
    .from("dedup_review_queue")
    .update({ phone_match_contact_id: targetId })
    .eq("phone_match_contact_id", sourceId);

  // 13. Log the merge event on the surviving contact.
  await logActivity(supabase, {
    contact_id: targetId,
    event_type: "contact_merged",
    payload: { merged_from_contact_id: sourceId, counts: preview },
    related_user_id: userId,
  });

  // 14. Delete the source contact.
  const del = await supabase.from("contacts").delete().eq("id", sourceId);
  if (del.error) {
    return { data: null, error: del.error };
  }

  return { data: preview, error: null };
}

async function countWhere(
  supabase: Client,
  table: string,
  column: string,
  value: string
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  return count ?? 0;
}
