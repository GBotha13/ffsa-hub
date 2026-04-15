import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOutreachTeamById,
  getTeamExpenses,
} from "@/services/outreach-finance";
import JSZip from "jszip";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const [{ data: team }, { data: expenses }] = await Promise.all([
    getOutreachTeamById(supabase, teamId),
    getTeamExpenses(supabase, teamId),
  ]);

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get all receipts for this team's expenses
  const expenseIds = (expenses ?? []).map(
    (e: { id: string }) => e.id
  );

  if (expenseIds.length === 0) {
    return NextResponse.json(
      { error: "No expenses found for this team" },
      { status: 404 }
    );
  }

  const { data: receipts } = await supabase
    .from("outreach_receipts")
    .select("*")
    .in("expense_id", expenseIds);

  if (!receipts || receipts.length === 0) {
    return NextResponse.json(
      { error: "No receipts found for this team" },
      { status: 404 }
    );
  }

  // Build expense lookup map
  const expenseMap: Record<
    string,
    { expense_date: string; receipt_code: string | null; vendor: string | null }
  > = {};
  for (const exp of expenses ?? []) {
    expenseMap[exp.id] = {
      expense_date: exp.expense_date,
      receipt_code: exp.receipt_code,
      vendor: exp.vendor,
    };
  }

  // Create ZIP
  const zip = new JSZip();

  // Add manifest CSV
  const manifestLines = [
    "File,Expense Date,Receipt Code,Vendor,File Name,File Size,Mime Type",
  ];

  let fileCount = 0;

  for (const receipt of receipts) {
    const expense = expenseMap[receipt.expense_id];
    if (!expense) continue;

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("outreach-receipts")
      .download(receipt.file_path);

    if (downloadError || !fileData) {
      continue; // Skip files that fail to download
    }

    // Build folder name: date_receiptCode
    const folderName = [
      expense.expense_date,
      expense.receipt_code ?? "no-code",
    ]
      .join("_")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const filePath = `receipts/${folderName}/${receipt.file_name}`;

    // Convert Blob to ArrayBuffer
    const buffer = await fileData.arrayBuffer();
    zip.file(filePath, buffer);

    manifestLines.push(
      [
        filePath,
        expense.expense_date,
        expense.receipt_code ?? "",
        expense.vendor ?? "",
        receipt.file_name,
        receipt.file_size,
        receipt.mime_type,
      ]
        .map((v) => {
          const s = String(v ?? "");
          return s.includes(",") ? `"${s}"` : s;
        })
        .join(",")
    );

    fileCount++;
  }

  if (fileCount === 0) {
    return NextResponse.json(
      { error: "No receipt files could be downloaded" },
      { status: 500 }
    );
  }

  // Add manifest
  zip.file("manifest.csv", manifestLines.join("\n"));

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

  const filename = `${team.team_name.replace(/[^a-zA-Z0-9]/g, "_")}_receipts.zip`;

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
