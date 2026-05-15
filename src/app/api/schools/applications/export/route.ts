import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeCsvValue(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("program_id");

  if (!programId) {
    return NextResponse.json(
      { error: "program_id is required" },
      { status: 400 }
    );
  }

  // Fetch program info
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("name, code")
    .eq("id", programId)
    .single();

  if (programError || !program) {
    return NextResponse.json(
      { error: "Program not found" },
      { status: 404 }
    );
  }

  // Fetch all questions for this program, ordered by sort_order
  const { data: questions } = await supabase
    .from("application_questions")
    .select("id, label, sort_order, type")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });

  const allQuestions = (questions ?? []).filter(
    (q) => q.type !== "section_header"
  );

  // Fetch all application responses for this program
  const { data: responses } = await supabase
    .from("application_responses")
    .select("*")
    .eq("program_id", programId)
    .order("submitted_at", { ascending: true });

  const allResponses = responses ?? [];

  // Fetch user info for responses that have a user_id
  const userIds = allResponses
    .map((r) => r.user_id)
    .filter((id): id is string => !!id);

  let usersMap = new Map<
    string,
    { first_name: string | null; last_name: string | null; email: string | null }
  >();

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .in("id", userIds);

    for (const u of users ?? []) {
      usersMap.set(u.id, u);
    }
  }

  // Fetch all reference requests for these applications
  const applicationIds = allResponses.map((r) => r.id);
  let referencesMap = new Map<string, Array<{ slotLabel: string; refereeName: string; status: string }>>();

  if (applicationIds.length > 0) {
    const { data: refRequests } = await (supabase as any)
      .from("reference_requests")
      .select("*, reference_slots(label)")
      .in("application_id", applicationIds);

    for (const ref of (refRequests ?? []) as any[]) {
      const appId = ref.application_id as string;
      if (!referencesMap.has(appId)) {
        referencesMap.set(appId, []);
      }
      const slotLabel = ref.reference_slots?.label ?? "Reference";
      referencesMap.get(appId)!.push({
        slotLabel,
        refereeName: ref.referee_name as string,
        status: ref.status as string,
      });
    }
  }

  // Build CSV headers
  const headers = [
    "Name",
    "Email",
    "Status",
    "Submitted Date",
    ...allQuestions.map((q) => q.label),
    "References",
    "Admin Notes",
  ];

  // Build CSV rows
  const rows: string[][] = [];

  for (const response of allResponses) {
    const applicantInfo = response.applicant_info as Record<string, any> | null;
    const userRecord = response.user_id
      ? usersMap.get(response.user_id)
      : null;

    // Name: prefer users table, fall back to applicant_info
    let name = "";
    if (userRecord?.first_name || userRecord?.last_name) {
      name = `${userRecord.first_name ?? ""} ${userRecord.last_name ?? ""}`.trim();
    } else if (applicantInfo) {
      name = `${applicantInfo.first_name ?? ""} ${applicantInfo.last_name ?? ""}`.trim();
    }

    // Email: prefer users table, fall back to applicant_email, then applicant_info
    let email = "";
    if (userRecord?.email) {
      email = userRecord.email;
    } else if (response.applicant_email) {
      email = response.applicant_email;
    } else if (applicantInfo?.email) {
      email = applicantInfo.email;
    }

    const status = response.status ?? "";
    const submittedAt = response.submitted_at
      ? new Date(response.submitted_at).toLocaleDateString("en-ZA")
      : "";

    // Map answers by question_id
    const answersArray = (response.answers as Array<{
      question_id: string;
      question_label?: string;
      answer: string;
    }>) ?? [];
    const answersMap = new Map<string, string>();
    for (const a of answersArray) {
      answersMap.set(a.question_id, a.answer);
    }

    const questionValues = allQuestions.map(
      (q) => answersMap.get(q.id) ?? ""
    );

    // Build references string
    const refs = referencesMap.get(response.id) ?? [];
    const referencesStr = refs
      .map((r) => `${r.slotLabel}: ${r.refereeName} (${r.status})`)
      .join(", ");

    const adminNotes = (response as any).admin_notes ?? "";

    rows.push([
      name,
      email,
      status,
      submittedAt,
      ...questionValues,
      referencesStr,
      adminNotes,
    ]);
  }

  // Build CSV content
  const csvLines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];
  const csvContent = csvLines.join("\n");

  const programCode = program.code || "applications";

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${programCode}-applications.csv"`,
    },
  });
}
