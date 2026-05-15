import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  const responseId = searchParams.get("response_id");

  if (!responseId) {
    return NextResponse.json(
      { error: "response_id is required" },
      { status: 400 }
    );
  }

  // Fetch the application response
  const { data: response, error: responseError } = await supabase
    .from("application_responses")
    .select("*")
    .eq("id", responseId)
    .single();

  if (responseError || !response) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 }
    );
  }

  // Fetch program info
  const { data: program } = await supabase
    .from("programs")
    .select("name, code")
    .eq("id", response.program_id)
    .single();

  // Fetch questions for this program
  const { data: questions } = await supabase
    .from("application_questions")
    .select("id, label, type, sort_order")
    .eq("program_id", response.program_id)
    .order("sort_order", { ascending: true });

  const allQuestions = (questions ?? []).filter(
    (q) => q.type !== "section_header"
  );

  // Get user info
  const applicantInfo = response.applicant_info as Record<string, any> | null;
  let userName = "";
  let userEmail = "";

  if (response.user_id) {
    const { data: userRecord } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("id", response.user_id)
      .single();

    if (userRecord) {
      userName = `${userRecord.first_name ?? ""} ${userRecord.last_name ?? ""}`.trim();
      userEmail = userRecord.email ?? "";
    }
  }

  if (!userName && applicantInfo) {
    userName = `${applicantInfo.first_name ?? ""} ${applicantInfo.last_name ?? ""}`.trim();
  }
  if (!userEmail) {
    userEmail =
      response.applicant_email ??
      (applicantInfo?.email as string | undefined) ??
      "";
  }

  // Fetch reference requests
  const { data: refRequests } = await (supabase as any)
    .from("reference_requests")
    .select("*, reference_slots(label, description)")
    .eq("application_id", responseId)
    .order("created_at", { ascending: true });

  const refs = ((refRequests ?? []) as any[]);

  // Build answers map
  const answersArray = (response.answers as Array<{
    question_id: string;
    question_label?: string;
    answer: string;
  }>) ?? [];
  const answersMap = new Map<string, string>();
  for (const a of answersArray) {
    answersMap.set(a.question_id, a.answer);
  }

  const adminNotes = (response as any).admin_notes ?? "";
  const submittedDate = response.submitted_at
    ? new Date(response.submitted_at).toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  // Build Q&A HTML
  let questionsHtml = "";
  for (const q of allQuestions) {
    const answer = answersMap.get(q.id) ?? "";
    questionsHtml += `
      <div class="qa-block">
        <div class="question">${escapeHtml(q.label)}</div>
        <div class="answer">${answer ? escapeHtml(answer) : '<span class="empty">No answer provided</span>'}</div>
      </div>`;
  }

  // Build references HTML
  let referencesHtml = "";
  if (refs.length > 0) {
    for (const ref of refs) {
      const slot = ref.reference_slots as any;
      const slotLabel = slot?.label ?? "Reference";
      const status = (ref.status as string) ?? "pending";
      const statusClass = status === "submitted" ? "status-submitted" : "status-pending";

      let refDetail = `
        <div class="ref-block">
          <div class="ref-header">
            <strong>${escapeHtml(slotLabel)}</strong>
            <span class="ref-status ${statusClass}">${escapeHtml(status)}</span>
          </div>
          <div class="ref-info">
            <span>${escapeHtml(ref.referee_name as string)}</span>
            <span class="ref-email">${escapeHtml(ref.referee_email as string)}</span>
          </div>`;

      if (status === "submitted") {
        if (ref.relationship) {
          refDetail += `<div class="ref-field"><strong>Relationship:</strong> ${escapeHtml(ref.relationship as string)}</div>`;
        }
        if (ref.known_duration) {
          refDetail += `<div class="ref-field"><strong>Known for:</strong> ${escapeHtml(ref.known_duration as string)}</div>`;
        }
        if (ref.reference_text) {
          refDetail += `<div class="ref-field"><strong>Reference:</strong> ${escapeHtml(ref.reference_text as string)}</div>`;
        }
      }

      refDetail += `</div>`;
      referencesHtml += refDetail;
    }
  } else {
    referencesHtml = '<p class="empty">No references requested</p>';
  }

  const programName = program?.name ?? "Unknown Program";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application — ${escapeHtml(userName || "Applicant")} — ${escapeHtml(programName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    .print-btn {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 0.5rem 1.5rem;
      border-radius: 6px;
      font-size: 0.875rem;
      cursor: pointer;
      margin-bottom: 1.5rem;
    }
    .print-btn:hover { background: #1d4ed8; }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
    }
    .program-name {
      color: #6b7280;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem 2rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .meta-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }
    .meta-value {
      font-size: 0.95rem;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: capitalize;
    }
    .status-submitted { background: #dbeafe; color: #1e40af; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-accepted { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .status-under_review { background: #e0e7ff; color: #3730a3; }
    section {
      margin-bottom: 2rem;
    }
    section h2 {
      font-size: 1.1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 1rem;
    }
    .qa-block {
      margin-bottom: 1.25rem;
    }
    .question {
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
    }
    .answer {
      font-size: 0.9rem;
      white-space: pre-wrap;
    }
    .empty {
      color: #9ca3af;
      font-style: italic;
    }
    .ref-block {
      padding: 0.75rem;
      background: #f9fafb;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      margin-bottom: 0.75rem;
    }
    .ref-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }
    .ref-status {
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .ref-info {
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    .ref-email {
      color: #6b7280;
      margin-left: 0.5rem;
    }
    .ref-field {
      font-size: 0.85rem;
      margin-top: 0.35rem;
    }
    .admin-notes {
      white-space: pre-wrap;
      padding: 0.75rem;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    @media print {
      .print-btn { display: none; }
      body { padding: 0; }
      .meta-grid { background: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .ref-block { background: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .admin-notes { background: #fffbeb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .status-badge, .ref-status { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print Application</button>

  <h1>${escapeHtml(userName || "Applicant")}</h1>
  <div class="program-name">${escapeHtml(programName)}</div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Email</div>
      <div class="meta-value">${escapeHtml(userEmail || "N/A")}</div>
    </div>
    <div>
      <div class="meta-label">Status</div>
      <div class="meta-value">
        <span class="status-badge status-${escapeHtml(response.status)}">${escapeHtml(response.status)}</span>
      </div>
    </div>
    <div>
      <div class="meta-label">Submitted</div>
      <div class="meta-value">${escapeHtml(submittedDate)}</div>
    </div>
    <div>
      <div class="meta-label">Application ID</div>
      <div class="meta-value" style="font-size:0.8rem;color:#6b7280;">${escapeHtml(response.id)}</div>
    </div>
  </div>

  <section>
    <h2>Application Responses</h2>
    ${questionsHtml}
  </section>

  <section>
    <h2>References</h2>
    ${referencesHtml}
  </section>

  ${adminNotes ? `
  <section>
    <h2>Admin Notes</h2>
    <div class="admin-notes">${escapeHtml(adminNotes)}</div>
  </section>
  ` : ""}
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
