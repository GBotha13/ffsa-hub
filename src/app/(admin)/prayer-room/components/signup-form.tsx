"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SignupFormProps {
  userId: string;
}

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export default function SignupForm({ userId }: SignupFormProps) {
  const [commitmentType, setCommitmentType] = useState("");
  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commitmentType || !startTime || !endTime || !startDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (commitmentType !== "one_off" && !dayOfWeek) {
      toast.error("Please select a day of the week");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        created_by: userId,
        commitment_type: commitmentType,
        start_time: startTime,
        end_time: endTime,
        start_date: startDate,
      };

      if (title.trim()) body.title = title.trim();
      if (commitmentType !== "one_off") body.day_of_week = parseInt(dayOfWeek);
      if (endDate) body.end_date = endDate;

      const res = await fetch("/api/prayer-room/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }

      toast.success("Sign-up submitted! An admin will review your request.");
      setCommitmentType("");
      setTitle("");
      setDayOfWeek("");
      setStartTime("");
      setEndTime("");
      setStartDate("");
      setEndDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Sign Up for a Devo Set</CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit a request to lead a devo set. An admin will review and approve it.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Commitment Type *</Label>
            <Select value={commitmentType} onValueChange={setCommitmentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_off">One-Off</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Morning Worship Set"
            />
          </div>

          {commitmentType && commitmentType !== "one_off" && (
            <div className="space-y-2">
              <Label>Day of Week *</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day..." />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {commitmentType === "one_off" ? "Date *" : "Start Date *"}
              </Label>
              <DateInput
                value={startDate}
                onChange={(v) => setStartDate(v)}
              />
            </div>
            {commitmentType && commitmentType !== "one_off" && (
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <DateInput
                  value={endDate}
                  onChange={(v) => setEndDate(v)}
                />
              </div>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Submitting..." : "Submit Sign-Up Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
