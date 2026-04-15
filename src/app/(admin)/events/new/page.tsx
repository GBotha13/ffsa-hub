"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function NewEventPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    max_capacity: "",
    is_public: false,
    registration_required: true,
  });

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Get current user ID for created_by
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { error: insertError } = await (supabase.from("events") as any).insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity, 10) : null,
      is_public: form.is_public,
      registration_required: form.registration_required,
      created_by: user.id,
      status: "draft" as const,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/events");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Event</h1>
        <p className="text-sm text-muted-foreground">
          Add a new event to the system
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => updateField("start_date", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => updateField("end_date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => updateField("start_time", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => updateField("end_time", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_capacity">Max Capacity</Label>
              <Input
                id="max_capacity"
                type="number"
                value={form.max_capacity}
                onChange={(e) => updateField("max_capacity", e.target.value)}
                placeholder="Leave blank for unlimited"
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_public}
                  onChange={(e) => updateField("is_public", e.target.checked)}
                  className="rounded border-input"
                />
                Public event
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.registration_required}
                  onChange={(e) =>
                    updateField("registration_required", e.target.checked)
                  }
                  className="rounded border-input"
                />
                Registration required
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Event"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
