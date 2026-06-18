import {
  KeyRound,
  RotateCcw,
  Mail,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/users/lifecycle";
import type { SecurityEvent } from "@/lib/users/security-events";

type Meta = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

const META: Record<string, Meta> = {
  password_reset_requested: { label: "Password reset requested", Icon: RotateCcw, tone: "text-amber-500" },
  password_changed: { label: "Password changed", Icon: KeyRound, tone: "text-emerald-500" },
  email_change_requested: { label: "Email change requested", Icon: Mail, tone: "text-amber-500" },
  email_changed: { label: "Email changed", Icon: MailCheck, tone: "text-emerald-500" },
  failed_login: { label: "Failed sign-in attempt", Icon: ShieldAlert, tone: "text-red-500" },
};

function detail(ev: SecurityEvent): string | null {
  const changes = ev.changes as { to?: unknown } | null;
  const to = changes && typeof changes === "object" ? changes.to : null;
  if (
    (ev.action === "email_changed" || ev.action === "email_change_requested") &&
    typeof to === "string"
  ) {
    return `→ ${to}`;
  }
  return null;
}

export function SecurityActivityCard({
  events,
  lastSignInAt,
}: {
  events: SecurityEvent[];
  lastSignInAt: string | null;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Security activity
        </h3>
        {lastSignInAt && (
          <span className="text-[11px] text-muted-foreground">
            Last signed in {formatRelativeTime(lastSignInAt)}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No recent password or email activity.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {events.map((ev) => {
            const meta =
              META[ev.action] ?? {
                label: ev.action,
                Icon: ShieldCheck,
                tone: "text-muted-foreground",
              };
            const Icon = meta.Icon;
            const d = detail(ev);
            return (
              <li key={ev.id} className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.tone}`} />
                <div className="min-w-0">
                  <div className="text-sm">
                    {meta.label}
                    {d && <span className="text-muted-foreground"> {d}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(ev.created_at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
