import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReferenceRequestsByApplication } from "@/services/schools";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("application_id");

  if (!applicationId) {
    return NextResponse.json(
      { error: "application_id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await getReferenceRequestsByApplication(
    supabase,
    applicationId
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ references: data });
}
