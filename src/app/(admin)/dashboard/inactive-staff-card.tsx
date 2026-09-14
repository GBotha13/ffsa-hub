"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InactiveStaffMember } from "@/app/api/dashboard/inactive-staff/route";

function timeAgo(iso: string | null, fallback: string): string {
  const ts = iso ? new Date(iso).getTime() : new Date(fallback).getTime();
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function staffLabel(member: InactiveStaffMember) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
  return name || member.email || "Unknown";
}

function roleLabel(roles: string[]) {
  return roles
    .map((r) => r.replace(/_/g, " "))
    .join(", ");
}

export function InactiveStaffCard() {
  const [staff, setStaff] = useState<InactiveStaffMember[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/dashboard/inactive-staff", { cache: "no-store" });
      if (!res.ok) {
        setStaff([]);
        return;
      }
      const json = await res.json();
      setStaff(json.staff ?? []);
    })();
  }, []);

  if (staff === null || staff.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--rule)",
        borderRadius: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-condensed)",
            fontWeight: 900,
            textTransform: "uppercase",
            fontSize: "1.15rem",
            letterSpacing: "0.07em",
            color: "var(--text-primary)",
          }}
        >
          Inactive Staff
        </p>
        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
          {staff.length} staff member{staff.length !== 1 ? "s" : ""} with no login in 3+ months
          — review and offboard as needed
        </p>
      </div>

      <div>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto auto",
            gap: "0 1rem",
            padding: "0.5rem 1.5rem",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          {["Name", "Roles", "Last login", ""].map((h) => (
            <p
              key={h}
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
              }}
            >
              {h}
            </p>
          ))}
        </div>

        {staff.map((member) => (
          <div
            key={member.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto auto",
              gap: "0 1rem",
              alignItems: "center",
              padding: "0.75rem 1.5rem",
              borderBottom: "1px solid var(--surface-2)",
            }}
          >
            <div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                {staffLabel(member)}
              </p>
              {member.email && (
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "1px" }}>
                  {member.email}
                </p>
              )}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {roleLabel(member.roles) || "—"}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {timeAgo(member.last_sign_in_at, member.created_at)}
            </p>
            <Link
              href={`/users/${member.id}`}
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              View →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
