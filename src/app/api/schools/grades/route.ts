import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bulkUpsertGrades } from "@/services/schools";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { grades } = body;

  if (!grades || !Array.isArray(grades) || grades.length === 0) {
    return NextResponse.json(
      { error: "grades array is required" },
      { status: 400 }
    );
  }

  const gradesWithGrader = grades.map(
    (g: { enrollment_id: string; course_id: string; letter_grade: string | null }) => ({
      ...g,
      graded_by: user.id,
    })
  );

  const { data, error } = await bulkUpsertGrades(supabase, gradesWithGrader);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, grades: data });
}
