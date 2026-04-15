"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function TranscriptButton({
  userId,
  programId,
}: {
  userId: string;
  programId: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        window.open(
          `/api/schools/transcript?userId=${userId}&programId=${programId}`,
          "_blank"
        );
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      Download Transcript
    </Button>
  );
}
