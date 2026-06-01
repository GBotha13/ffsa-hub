"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FollowupQueueRow } from "@/services/event-followup";
import type { AssignableFollowupHandler } from "@/lib/auth/assignable-followup-handlers";
import { FollowupDrawer } from "./followup-drawer";

type AssignmentFilter = "all" | "unassigned" | "mine";
type AgingFilter = "all" | "attention";

export function FollowupQueue({
  queue,
  handlersByEvent,
  currentUserId,
}: {
  queue: FollowupQueueRow[];
  handlersByEvent: Record<string, AssignableFollowupHandler[]>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignmentFilter, setAssignmentFilter] =
    useState<AssignmentFilter>("all");
  const [agingFilter, setAgingFilter] = useState<AgingFilter>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const events = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of queue) map.set(r.event.id, r.event.title);
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [queue]);

  const filtered = useMemo(() => {
    return queue.filter((r) => {
      if (assignmentFilter === "unassigned" && r.assigned_staff_id) return false;
      if (
        assignmentFilter === "mine" &&
        r.assigned_staff_id !== currentUserId
      )
        return false;
      if (agingFilter === "attention" && r.days_in_pipeline < 3) return false;
      if (eventFilter !== "all" && r.event.id !== eventFilter) return false;
      return true;
    });
  }, [queue, assignmentFilter, agingFilter, eventFilter, currentUserId]);

  const selected = useMemo(
    () => queue.find((r) => r.enrollment_id === selectedId) ?? null,
    [queue, selectedId]
  );

  function onRowChanged() {
    router.refresh();
  }

  return (
    <>
      <FilterBar
        assignmentFilter={assignmentFilter}
        onAssignmentChange={setAssignmentFilter}
        agingFilter={agingFilter}
        onAgingChange={setAgingFilter}
        eventFilter={eventFilter}
        onEventChange={setEventFilter}
        events={events}
        unassignedCount={queue.filter((r) => !r.assigned_staff_id).length}
        mineCount={
          queue.filter((r) => r.assigned_staff_id === currentUserId).length
        }
        attentionCount={
          queue.filter((r) => r.days_in_pipeline >= 3).length
        }
      />

      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: "hsl(22 10% 8%)",
          border: "1px solid hsl(22 8% 14%)",
        }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "hsl(22 8% 14%)" }}>
              <TableHead style={th}>Person</TableHead>
              <TableHead style={th}>Event / Outcome</TableHead>
              <TableHead style={th}>Stage</TableHead>
              <TableHead style={{ ...th, textAlign: "right" }}>Age</TableHead>
              <TableHead style={th}>Assigned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "3rem 1rem",
                    color: "hsl(30 8% 45%)",
                    fontSize: "13px",
                  }}
                >
                  No follow-ups match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.enrollment_id}
                  onClick={() => setSelectedId(r.enrollment_id)}
                  style={{
                    cursor: "pointer",
                    borderColor: "hsl(22 8% 12%)",
                    background: r.is_unread
                      ? "hsl(42 30% 8%)"
                      : "transparent",
                  }}
                  className="hover:bg-white/5"
                >
                  <TableCell>
                    <div style={{ color: "#F0EBE3", fontSize: "13px", fontWeight: 500 }}>
                      {personLabel(r.contact)}
                    </div>
                    {r.contact.email && (
                      <div style={{ color: "hsl(30 8% 50%)", fontSize: "11px" }}>
                        {r.contact.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div style={{ color: "#F0EBE3", fontSize: "13px" }}>
                      {r.event.title}
                    </div>
                    <div style={{ color: "hsl(30 8% 50%)", fontSize: "11px" }}>
                      {r.outcome.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ color: "hsl(30 8% 70%)", fontSize: "12px" }}>
                      {r.stage_label}
                    </div>
                    {r.total_steps > 0 && (
                      <div
                        style={{
                          color: "hsl(30 8% 45%)",
                          fontSize: "10px",
                          letterSpacing: "0.05em",
                          marginTop: "2px",
                        }}
                      >
                        Step {Math.min(r.steps_done + 1, r.total_steps)} of {r.total_steps}
                      </div>
                    )}
                  </TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    <AgeBadge days={r.days_in_pipeline} />
                  </TableCell>
                  <TableCell>
                    {r.assigned_staff ? (
                      <span style={{ color: "#F0EBE3", fontSize: "12px" }}>
                        {personLabel(r.assigned_staff)}
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "hsl(42 95% 55%)",
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}
                      >
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <FollowupDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        row={selected}
        handlersByEvent={handlersByEvent}
        currentUserId={currentUserId}
        onChanged={onRowChanged}
      />
    </>
  );
}

const th: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.15em",
  fontWeight: 700,
  color: "hsl(30 8% 42%)",
  textTransform: "uppercase",
  padding: "12px 16px",
};

function personLabel(p: {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email?: string | null;
}) {
  const first = p.preferred_name || p.first_name || "";
  const last = p.last_name || "";
  const name = `${first} ${last}`.trim();
  return name || p.email || "—";
}

function AgeBadge({ days }: { days: number }) {
  const palette =
    days >= 7
      ? { bg: "hsl(0 60% 18%)", fg: "hsl(0 80% 65%)" }
      : days >= 3
      ? { bg: "hsl(42 80% 18%)", fg: "hsl(42 95% 60%)" }
      : { bg: "hsl(22 10% 14%)", fg: "hsl(30 8% 60%)" };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        padding: "3px 8px",
        borderRadius: "4px",
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {days}d
    </span>
  );
}

function FilterBar({
  assignmentFilter,
  onAssignmentChange,
  agingFilter,
  onAgingChange,
  eventFilter,
  onEventChange,
  events,
  unassignedCount,
  mineCount,
  attentionCount,
}: {
  assignmentFilter: AssignmentFilter;
  onAssignmentChange: (v: AssignmentFilter) => void;
  agingFilter: AgingFilter;
  onAgingChange: (v: AgingFilter) => void;
  eventFilter: string;
  onEventChange: (v: string) => void;
  events: { id: string; title: string }[];
  unassignedCount: number;
  mineCount: number;
  attentionCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip
        active={assignmentFilter === "all"}
        onClick={() => onAssignmentChange("all")}
        label="All"
      />
      <Chip
        active={assignmentFilter === "unassigned"}
        onClick={() => onAssignmentChange("unassigned")}
        label="Unassigned"
        count={unassignedCount}
      />
      <Chip
        active={assignmentFilter === "mine"}
        onClick={() => onAssignmentChange("mine")}
        label="Mine"
        count={mineCount}
      />
      <div style={{ width: "1px", height: "20px", background: "hsl(22 8% 18%)", margin: "0 4px" }} />
      <Chip
        active={agingFilter === "attention"}
        onClick={() =>
          onAgingChange(agingFilter === "attention" ? "all" : "attention")
        }
        label="Aging > 3d"
        count={attentionCount}
      />
      {events.length > 1 && (
        <>
          <div style={{ width: "1px", height: "20px", background: "hsl(22 8% 18%)", margin: "0 4px" }} />
          <select
            value={eventFilter}
            onChange={(e) => onEventChange(e.target.value)}
            style={{
              fontSize: "12px",
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid hsl(22 8% 18%)",
              background: "hsl(22 10% 10%)",
              color: "#F0EBE3",
            }}
          >
            <option value="all">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "6px 12px",
        borderRadius: "999px",
        border: active
          ? "1px solid hsl(42 95% 55%)"
          : "1px solid hsl(22 8% 18%)",
        background: active ? "hsl(42 95% 55% / 0.12)" : "hsl(22 10% 10%)",
        color: active ? "hsl(42 95% 60%)" : "hsl(30 8% 70%)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {label}
      {count !== undefined && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "999px",
            background: active ? "hsl(42 95% 55%)" : "hsl(22 8% 18%)",
            color: active ? "#0D0B09" : "hsl(30 8% 70%)",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
