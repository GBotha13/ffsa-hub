import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  upsertFeeStructure,
  deleteFeeStructure,
} from "@/services/school-fees";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { program_id, tier, tuition_zar, accommodation_zar, meals_zar, materials_zar } = body;

  if (!program_id || !tier) {
    return NextResponse.json(
      { error: "program_id and tier are required" },
      { status: 400 }
    );
  }

  const { data, error } = await upsertFeeStructure(supabase, {
    program_id,
    tier,
    tuition_zar: tuition_zar ?? 0,
    accommodation_zar: accommodation_zar ?? 0,
    meals_zar: meals_zar ?? 0,
    materials_zar: materials_zar ?? 0,
    notes: body.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { program_id, tier } = body;

  if (!program_id || !tier) {
    return NextResponse.json(
      { error: "program_id and tier are required" },
      { status: 400 }
    );
  }

  const { data, error } = await upsertFeeStructure(supabase, {
    program_id,
    tier,
    tuition_zar: body.tuition_zar ?? 0,
    accommodation_zar: body.accommodation_zar ?? 0,
    meals_zar: body.meals_zar ?? 0,
    materials_zar: body.materials_zar ?? 0,
    notes: body.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await deleteFeeStructure(supabase, id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
