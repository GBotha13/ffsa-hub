"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { FieldConfig } from "./profile-completion-gate";

export function ProfileCompletionForm({
  missingFields,
}: {
  missingFields: FieldConfig[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate all fields are filled
    for (const f of missingFields) {
      if (!values[f.field]?.trim()) {
        setError(`Please fill in: ${f.label}`);
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update profile");
        return;
      }

      // Refresh the page — the gate will re-check and let them through
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-4 shadow-2xl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Please fill in the following information to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {missingFields.map((f) => (
            <div key={f.field} className="space-y-2">
              <Label htmlFor={`gate-${f.field}`}>{f.label}</Label>

              {f.type === "select" && f.options ? (
                <select
                  id={`gate-${f.field}`}
                  value={values[f.field] ?? ""}
                  onChange={(e) => setValue(f.field, e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select...</option>
                  {f.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`gate-${f.field}`}
                  type={f.type === "date" ? "date" : f.type === "tel" ? "tel" : "text"}
                  placeholder={f.placeholder}
                  value={values[f.field] ?? ""}
                  onChange={(e) => setValue(f.field, e.target.value)}
                  required
                />
              )}
            </div>
          ))}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
