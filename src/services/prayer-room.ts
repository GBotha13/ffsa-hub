// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// SERIES (sign-up requests / commitments)
// ────────────────────────────────────────────────────────────

export async function getSeries(
  supabase: Client,
  options?: { status?: string; userId?: string; commitmentType?: string }
) {
  let query = supabase
    .from("prayer_room_series")
    .select("*, users:created_by(id, first_name, last_name, preferred_name)")
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.userId) query = query.eq("created_by", options.userId);
  if (options?.commitmentType) query = query.eq("commitment_type", options.commitmentType);

  return query;
}

export async function getSeriesById(supabase: Client, id: string) {
  return supabase
    .from("prayer_room_series")
    .select("*, users:created_by(id, first_name, last_name, preferred_name)")
    .eq("id", id)
    .single();
}

export async function createSeries(
  supabase: Client,
  data: {
    created_by: string;
    commitment_type: string;
    title?: string;
    day_of_week?: number;
    start_time: string;
    end_time: string;
    start_date: string;
    end_date?: string;
  }
) {
  return supabase
    .from("prayer_room_series")
    .insert({ ...data, status: "pending" })
    .select()
    .single();
}

export async function updateSeries(
  supabase: Client,
  id: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("prayer_room_series")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function approveSeries(
  supabase: Client,
  id: string,
  reviewedBy: string
) {
  // Update series status
  const { data, error } = await supabase
    .from("prayer_room_series")
    .update({
      status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { data, error };

  // Generate slots
  await generateSlotsForSeries(supabase, data);

  return { data, error: null };
}

export async function rejectSeries(
  supabase: Client,
  id: string,
  reviewedBy: string,
  reason?: string
) {
  return supabase
    .from("prayer_room_series")
    .update({
      status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason ?? null,
    })
    .eq("id", id)
    .select()
    .single();
}

export async function cancelSeries(supabase: Client, id: string) {
  // Cancel the series
  await supabase
    .from("prayer_room_series")
    .update({ status: "cancelled" })
    .eq("id", id);

  // Cancel all future slots for this series
  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("prayer_room_slots")
    .update({ status: "cancelled" })
    .eq("series_id", id)
    .eq("status", "scheduled")
    .gte("slot_date", today);

  return { error: null };
}

// ────────────────────────────────────────────────────────────
// SLOT GENERATION
// ────────────────────────────────────────────────────────────

async function generateSlotsForSeries(
  supabase: Client,
  series: {
    id: string;
    created_by: string;
    commitment_type: string;
    title?: string;
    day_of_week?: number;
    start_time: string;
    end_time: string;
    start_date: string;
    end_date?: string;
  }
) {
  const slots: {
    series_id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    title: string | null;
  }[] = [];

  if (series.commitment_type === "one_off") {
    slots.push({
      series_id: series.id,
      slot_date: series.start_date,
      start_time: series.start_time,
      end_time: series.end_time,
      title: series.title ?? null,
    });
  } else {
    // Weekly or quarterly — generate slots for each matching day
    const startDate = new Date(series.start_date + "T00:00:00");
    let endDate: Date;

    if (series.end_date) {
      endDate = new Date(series.end_date + "T00:00:00");
    } else {
      // Ongoing weekly — generate 1 year ahead
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const targetDow = series.day_of_week ?? 0;
    const current = new Date(startDate);

    // Advance to the first matching day of week
    while (current.getDay() !== targetDow) {
      current.setDate(current.getDate() + 1);
    }

    while (current <= endDate) {
      slots.push({
        series_id: series.id,
        slot_date: current.toISOString().split("T")[0],
        start_time: series.start_time,
        end_time: series.end_time,
        title: series.title ?? null,
      });
      current.setDate(current.getDate() + 7);
    }
  }

  if (slots.length > 0) {
    const { data: insertedSlots, error: insertError } = await supabase
      .from("prayer_room_slots")
      .insert(slots)
      .select("id");

    if (insertError) {
      console.error("[generateSlots] insert error:", insertError);
      return 0;
    }

    // Auto-add the series creator as a member of each generated slot
    if (insertedSlots && insertedSlots.length > 0) {
      const memberRows = insertedSlots.map((s: { id: string }) => ({
        slot_id: s.id,
        user_id: series.created_by,
        role: "worship_leader",
        assigned_by: series.created_by,
      }));
      await supabase.from("prayer_room_slot_members").insert(memberRows);
    }
  }

  return slots.length;
}

// ────────────────────────────────────────────────────────────
// SLOTS (schedule entries)
// ────────────────────────────────────────────────────────────

export async function getSlots(
  supabase: Client,
  options?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }
) {
  let query = supabase
    .from("prayer_room_slots")
    .select(`
      *,
      series:series_id(id, commitment_type, created_by),
      members:prayer_room_slot_members(
        id, user_id, role, instrument,
        users!prayer_room_slot_members_user_id_fkey(id, first_name, last_name, preferred_name)
      )
    `)
    .order("slot_date")
    .order("start_time");

  if (options?.dateFrom) query = query.gte("slot_date", options.dateFrom);
  if (options?.dateTo) query = query.lte("slot_date", options.dateTo);
  if (options?.status) {
    query = query.eq("status", options.status);
  } else {
    query = query.in("status", ["scheduled", "completed"]);
  }

  return query;
}

export async function getSlotById(supabase: Client, id: string) {
  return supabase
    .from("prayer_room_slots")
    .select(`
      *,
      series:series_id(id, commitment_type, created_by),
      members:prayer_room_slot_members(
        id, user_id, role, instrument,
        users!prayer_room_slot_members_user_id_fkey(id, first_name, last_name, preferred_name)
      )
    `)
    .eq("id", id)
    .single();
}

export async function updateSlot(
  supabase: Client,
  id: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("prayer_room_slots")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function completeSlot(
  supabase: Client,
  id: string,
  notes?: string
) {
  return supabase
    .from("prayer_room_slots")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq("id", id)
    .select()
    .single();
}

export async function getMySlots(
  supabase: Client,
  userId: string,
  options?: { upcoming?: boolean }
) {
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("prayer_room_slot_members")
    .select(`
      *,
      slot:prayer_room_slots(
        id, slot_date, start_time, end_time, title, status, notes, completed_at,
        series:series_id(commitment_type)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.upcoming) {
    // Need to filter by slot date — use inner join filter
    query = supabase
      .from("prayer_room_slot_members")
      .select(`
        *,
        slot:prayer_room_slots!inner(
          id, slot_date, start_time, end_time, title, status, notes, completed_at,
          series:series_id(commitment_type)
        )
      `)
      .eq("user_id", userId)
      .gte("prayer_room_slots.slot_date", today)
      .eq("prayer_room_slots.status", "scheduled")
      .order("created_at", { ascending: true });
  }

  return query;
}

// ────────────────────────────────────────────────────────────
// SLOT MEMBERS (team roster)
// ────────────────────────────────────────────────────────────

export async function addSlotMember(
  supabase: Client,
  data: {
    slot_id: string;
    user_id: string;
    role: string;
    instrument?: string;
    assigned_by: string;
  }
) {
  return supabase
    .from("prayer_room_slot_members")
    .insert(data)
    .select("*, users(id, first_name, last_name, preferred_name)")
    .single();
}

export async function removeSlotMember(
  supabase: Client,
  slotId: string,
  userId: string
) {
  return supabase
    .from("prayer_room_slot_members")
    .delete()
    .eq("slot_id", slotId)
    .eq("user_id", userId);
}

export async function getSlotMembers(supabase: Client, slotId: string) {
  return supabase
    .from("prayer_room_slot_members")
    .select("*, users(id, first_name, last_name, preferred_name)")
    .eq("slot_id", slotId)
    .order("role")
    .order("created_at");
}

// ────────────────────────────────────────────────────────────
// STATS
// ────────────────────────────────────────────────────────────

export async function getPendingCount(supabase: Client) {
  const { count } = await supabase
    .from("prayer_room_series")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return count ?? 0;
}
