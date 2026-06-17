"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

export type AssignedRole = {
  id: string;
  role_id: string;
  scope_type: string | null;
  scope_id: string | null;
  display_name: string;
};
export type AssignableRole = { id: string; display_name: string };

export function RoleAssignment({
  userId,
  assigned,
  assignable,
  scopeLabels,
  canManage,
}: {
  userId: string;
  assigned: AssignedRole[];
  assignable: AssignableRole[];
  scopeLabels: Record<string, string>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const assignedIds = new Set(assigned.map((a) => a.role_id));
  const options = assignable.filter((r) => !assignedIds.has(r.id));

  async function addRole(roleId: string) {
    setBusy(true);
    setOpen(false);
    const res = await fetch("/api/admin/grant-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role_id: roleId }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      toast.error(b.error ?? "Could not add the title");
      return;
    }
    toast.success("Title added");
    router.refresh();
  }

  async function removeRole(a: AssignedRole) {
    setBusy(true);
    const res = await fetch("/api/admin/revoke-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        role_id: a.role_id,
        scope_type: a.scope_type,
        scope_id: a.scope_id,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      toast.error(b.error ?? "Could not remove the title");
      return;
    }
    toast.success("Title removed");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "hsl(22 10% 8%)",
        border: "1px solid hsl(22 8% 14%)",
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
          fontSize: "1rem",
          letterSpacing: "0.07em",
          color: "#F0EBE3",
          marginBottom: "4px",
        }}
      >
        Job titles
      </p>
      <p style={{ fontSize: "13px", color: "hsl(30 8% 50%)", marginBottom: "14px" }}>
        Stack as many as fit the person — access is the combined total of every title.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        {assigned.length === 0 && (
          <span style={{ fontSize: "13px", color: "hsl(30 8% 45%)" }}>No titles yet.</span>
        )}

        {assigned.map((a) => (
          <span
            key={a.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "hsl(42 95% 55% / 0.12)",
              color: "hsl(42 90% 72%)",
              border: "1px solid hsl(42 95% 55% / 0.25)",
              borderRadius: "8px",
              padding: "5px 10px",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {a.display_name}
            {a.scope_id && scopeLabels[a.scope_id] && (
              <span style={{ color: "hsl(42 55% 58%)", fontSize: "11px" }}>
                · {scopeLabels[a.scope_id]}
              </span>
            )}
            {canManage && (
              <button
                onClick={() => removeRole(a)}
                disabled={busy}
                aria-label={`Remove ${a.display_name}`}
                style={{ display: "inline-flex", cursor: "pointer", color: "hsl(42 70% 60%)" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}

        {canManage && (
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={() => setOpen((o) => !o)}
              disabled={busy || options.length === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                border: "1px dashed hsl(22 8% 28%)",
                background: "transparent",
                color: "hsl(30 8% 60%)",
                borderRadius: "8px",
                padding: "5px 10px",
                fontSize: "13px",
                cursor: options.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add title
            </button>
            {open && options.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 20,
                  minWidth: "200px",
                  maxHeight: "260px",
                  overflowY: "auto",
                  background: "hsl(22 12% 10%)",
                  border: "1px solid hsl(22 8% 18%)",
                  borderRadius: "8px",
                  padding: "4px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
              >
                {options.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addRole(r.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 10px",
                      fontSize: "13px",
                      color: "#F0EBE3",
                      background: "transparent",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
