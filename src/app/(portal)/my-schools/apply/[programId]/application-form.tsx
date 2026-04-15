"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

type Question = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  is_required: boolean;
};

export function ApplicationForm({
  programId,
  questions,
}: {
  programId: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate required fields
    for (const q of questions) {
      if (q.is_required && !answers[q.id]?.trim()) {
        setError(`Please answer: "${q.label}"`);
        return;
      }
    }

    setLoading(true);

    const formattedAnswers = questions.map((q) => ({
      question_id: q.id,
      question_label: q.label,
      answer: answers[q.id]?.trim() ?? "",
    }));

    try {
      const res = await fetch("/api/schools/applications/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          answers: formattedAnswers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit application");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
          <h2 className="text-lg font-semibold">Application Submitted!</h2>
          <p className="text-sm text-muted-foreground">
            Your application has been received and is under review. You will be
            notified when a decision has been made.
          </p>
          <Button variant="outline" onClick={() => router.push("/my-schools")}>
            Back to My Schools
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {questions.map((q, idx) => (
        <div key={q.id} className="space-y-2">
          <Label className="text-sm font-medium">
            {idx + 1}. {q.label}
            {q.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {q.description && (
            <p className="text-xs text-muted-foreground">{q.description}</p>
          )}
          {q.type === "long_answer" ? (
            <Textarea
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder="Your answer..."
              rows={5}
              required={q.is_required}
            />
          ) : (
            <Input
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder="Your answer..."
              required={q.is_required}
            />
          )}
        </div>
      ))}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Application"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/my-schools")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
