import type { Database, EventRegistrationInsert } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function getRegistrationsForEvent(
  supabase: Client,
  eventId: string
) {
  return supabase
    .from("event_registrations")
    .select("*, contacts!contact_id(id, first_name, last_name, preferred_name, email, phone)")
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });
}

export async function getRegistrationsForContact(
  supabase: Client,
  contactId: string
) {
  return supabase
    .from("event_registrations")
    .select("*, events(id, title, start_date, end_date, location, status)")
    .eq("contact_id", contactId)
    .order("registered_at", { ascending: false });
}

export async function createRegistration(
  supabase: Client,
  data: EventRegistrationInsert
) {
  return supabase.from("event_registrations").insert(data).select().single();
}

export async function updateRegistrationStatus(
  supabase: Client,
  id: string,
  status: "pending" | "confirmed" | "waitlisted" | "cancelled"
) {
  return supabase
    .from("event_registrations")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
}

export async function getRegistrationCount(
  supabase: Client,
  eventId: string
) {
  const { count, error } = await supabase
    .from("event_registrations")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .neq("status", "cancelled");

  return { count: count ?? 0, error };
}
