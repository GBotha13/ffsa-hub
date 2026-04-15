import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTranscriptData } from "@/services/schools";
import { renderToBuffer } from "@react-pdf/renderer";
import { TranscriptDocument } from "@/lib/transcript-pdf";
import React from "react";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const programId = searchParams.get("programId");

  if (!userId || !programId) {
    return NextResponse.json(
      { error: "userId and programId are required" },
      { status: 400 }
    );
  }

  const transcriptData = await getTranscriptData(supabase, userId, programId);

  if (!transcriptData) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(
    React.createElement(TranscriptDocument, { data: transcriptData }) as any
  );

  const filename = `Transcript_${transcriptData.student.lastName}_${transcriptData.program.code}_${transcriptData.issueDate}.pdf`;

  return new NextResponse(Buffer.from(pdfBuffer) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
