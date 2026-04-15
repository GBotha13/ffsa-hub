"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function CreateProgramForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [creditHours, setCreditHours] = useState("0");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/schools/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: code.toUpperCase(),
          description: description || null,
          credit_hours: parseInt(creditHours) || 0,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create program");
        return;
      }

      setName("");
      setCode("");
      setDescription("");
      setCreditHours("0");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Program
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Program</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="prog-name">Program Name *</Label>
            <Input
              id="prog-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Discipleship Training School"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prog-code">Code *</Label>
              <Input
                id="prog-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. DTS"
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="prog-credits">Total Credit Hours</Label>
              <Input
                id="prog-credits"
                type="number"
                min="0"
                value={creditHours}
                onChange={(e) => setCreditHours(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="prog-desc">Description</Label>
            <Input
              id="prog-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Program"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
