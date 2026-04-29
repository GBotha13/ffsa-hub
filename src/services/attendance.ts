import type { Database, TablesInsert } from "@/types/database";
type AttendanceRecordInsert = TablesInsert<"attendance_records">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function getAttendanceForEvent(
  supabase: Client,
  eventId: string
) {
  return supabase
    .from("attendance_records")
    .select("*, contacts!contact_id(id, first_name, last_name, preferred_name, email)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
}

export async function getAttendanceForContact(
  supabase: Client,
  contactId: string
) {
  return supabase
    .from("attendance_records")
    .select("*, events(id, title, start_date, location)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
}

export async function recordAttendance(
  supabase: Client,
  data: AttendanceRecordInsert
) {
  return supabase
    .from("attendance_records")
    .upsert(data, { onConflict: "contact_id,event_id" })
    .select()
    .single();
}

export async function bulkRecordAttendance(
  supabase: Client,
  records: AttendanceRecordInsert[]
) {
  return supabase
    .from("attendance_records")
    .upsert(records, { onConflict: "contact_id,event_id" })
    .select();
}

export async function updateAttendanceStatus(
  supabase: Client,
  id: string,
  status: "present" | "absent" | "late" | "excused"
) {
  return supabase
    .from("attendance_records")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
}
