"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

type Question = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  is_required: boolean;
  options: string[] | null;
};

type ReferenceSlot = {
  id: string;
  label: string;
  description: string | null;
  is_required: boolean;
};

export function PublicApplicationForm({
  programId,
  programName,
  questions,
  referenceSlots = [],
}: {
  programId: string;
  programName: string;
  questions: Question[];
  referenceSlots?: ReferenceSlot[];
}) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  // Question answers
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // References
  const [refNames, setRefNames] = useState<Record<string, string>>({});
  const [refEmails, setRefEmails] = useState<Record<string, string>>({});

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate required question answers
    for (const q of questions) {
      if (q.is_required && !answers[q.id]?.trim()) {
        setError(`Please answer the required question: "${q.label}"`);
        setLoading(false);
        return;
      }
    }

    // Validate required reference slots
    for (const slot of referenceSlots) {
      if (slot.is_required && (!refNames[slot.id]?.trim() || !refEmails[slot.id]?.trim())) {
        setError(`Please provide referee details for: "${slot.label}"`);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/public/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          applicant_info: {
            first_name: firstName,
            last_name: lastName,
            email,
            phone: phone || null,
            date_of_birth: dateOfBirth || null,
            gender: gender || null,
            nationality: nationality || null,
            country: country || null,
            city: city || null,
          },
          answers: questions.map((q) => ({
            question_id: q.id,
            question_label: q.label,
            answer: answers[q.id] ?? "",
          })),
          references: referenceSlots
            .filter((slot) => refNames[slot.id]?.trim() && refEmails[slot.id]?.trim())
            .map((slot) => ({
              slot_id: slot.id,
              referee_name: refNames[slot.id].trim(),
              referee_email: refEmails[slot.id].trim(),
            })),
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
      <div className="text-center space-y-4 py-8">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-xl font-bold text-foreground">
          Application Submitted!
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Thank you for applying to {programName}. We've sent a confirmation to
          your email. Our team will review your application and get back to you
          soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Personal Information */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </div>
          <div>
            <Label>
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>

        <div>
          <Label>
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+27 ..."
            />
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nationality</Label>
            <Input
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. South African"
            />
          </div>
          <div>
            <Label>Country</Label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. South Africa"
            />
          </div>
        </div>

        <div className="sm:w-1/2">
          <Label>City</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Cape Town"
          />
        </div>
      </div>

      {/* Application Questions */}
      {questions.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">
            Application Questions
          </h2>

          {questions.map((q) => (
            <div key={q.id} className="space-y-1">
              <Label>
                {q.label}
                {q.is_required && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>
              {q.description && (
                <p className="text-xs text-muted-foreground">{q.description}</p>
              )}
              {q.type === "multiple_choice" && q.options && q.options.length > 0 ? (
                <div className="flex flex-col gap-2 pt-1">
                  {q.options.map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={option}
                        checked={answers[q.id] === option}
                        onChange={() => setAnswer(q.id, option)}
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              ) : q.type === "long_answer" ? (
                <Textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  rows={4}
                  placeholder="Your answer..."
                />
              ) : (
                <Input
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Your answer..."
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* References */}
      {referenceSlots.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">References</h2>
          <p className="text-sm text-muted-foreground">
            Please provide contact details for the following references. They will receive an email with a link to submit their reference.
          </p>

          {referenceSlots.map((slot) => (
            <div key={slot.id} className="space-y-3 rounded-md border p-4">
              <div>
                <p className="text-sm font-medium">
                  {slot.label}
                  {slot.is_required && <span className="text-destructive"> *</span>}
                </p>
                {slot.description && (
                  <p className="text-xs text-muted-foreground">{slot.description}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Referee Name {slot.is_required && <span className="text-destructive">*</span>}</Label>
                  <Input
                    placeholder="Full name"
                    value={refNames[slot.id] ?? ""}
                    onChange={(e) => setRefNames((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                    required={slot.is_required}
                  />
                </div>
                <div>
                  <Label>Referee Email {slot.is_required && <span className="text-destructive">*</span>}</Label>
                  <Input
                    type="email"
                    placeholder="referee@email.com"
                    value={refEmails[slot.id] ?? ""}
                    onChange={(e) => setRefEmails((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                    required={slot.is_required}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
