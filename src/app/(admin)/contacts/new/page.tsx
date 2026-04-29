"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface DuplicateMatch {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

export default function NewContactPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    preferred_name: "",
    email: "",
    phone: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDuplicates([]);
    setSkipDuplicateCheck(false);
  }

  async function checkDuplicates() {
    if (!form.first_name || !form.last_name) return [];

    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name, email, phone, status")
      .eq("status", "active")
      .or(
        [
          form.email ? `email.ilike.${form.email.trim().toLowerCase()}` : null,
          `and(first_name.ilike.${form.first_name.trim()},last_name.ilike.${form.last_name.trim()})`,
        ]
          .filter(Boolean)
          .join(",")
      )
      .limit(10);

    return data ?? [];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!skipDuplicateCheck) {
      const matches = await checkDuplicates();
      if (matches.length > 0) {
        setDuplicates(matches);
        setLoading(false);
        return;
      }
    }

    const { error: insertError } = await (supabase.from("contacts") as any).insert({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      preferred_name: form.preferred_name.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      phone: form.phone.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/contacts");
    router.refresh();
  }

  function handleUseExisting(id: string) {
    router.push(`/contacts/${id}`);
  }

  function handleCreateAnyway() {
    setSkipDuplicateCheck(true);
    setDuplicates([]);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="page-eyebrow">PEOPLE &amp; RELATIONSHIPS</p>
        <h1 className="page-title">Add Contact</h1>
      </div>

      {duplicates.length > 0 && (
        <Card style={{ borderColor: 'var(--yellow-border)', background: 'rgba(245,197,24,0.06)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base" style={{ color: 'var(--yellow)' }}>
              <AlertTriangle className="h-5 w-5" />
              Potential Duplicates Found
            </CardTitle>
            <CardDescription>
              The following existing records may match. Use an existing record or create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {duplicates.map((dup) => (
              <div
                key={dup.id}
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-3"
              >
                <div>
                  <p className="font-medium">
                    {dup.first_name} {dup.last_name}
                    {dup.preferred_name && (
                      <span className="text-muted-foreground"> ({dup.preferred_name})</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[dup.email, dup.phone].filter(Boolean).join(" · ") || "No contact info"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUseExisting(dup.id)}
                >
                  Use this record
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateAnyway}
              className="text-yellow-700 hover:text-yellow-900"
            >
              Create new contact anyway
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_name">Preferred Name</Label>
              <Input
                id="preferred_name"
                value={form.preferred_name}
                onChange={(e) => updateField("preferred_name", e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Contact"}
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
