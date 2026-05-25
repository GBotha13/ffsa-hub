/**
 * Identity header shared between the Profile and Permissions tabs.
 */
export function UserHeader({
  user,
  eyebrow,
}: {
  user: {
    first_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
    display_name?: string | null;
    email?: string | null;
    job_title?: string | null;
    status?: string | null;
  };
  eyebrow: string;
}) {
  const name =
    user.display_name ??
    (user.first_name
      ? `${user.preferred_name ?? user.first_name} ${user.last_name ?? ""}`.trim()
      : user.email ?? "Unknown User");

  const status = user.status ?? "invited";
  const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "hsl(142 60% 20%)", fg: "hsl(142 60% 55%)", label: "Active" },
    pending_approval: {
      bg: "hsl(42 80% 18%)",
      fg: "hsl(42 95% 55%)",
      label: "Pending Approval",
    },
    invited: { bg: "hsl(22 8% 15%)", fg: "hsl(30 8% 55%)", label: "Invited" },
  };
  const s = statusColors[status] ?? statusColors.invited;

  // Big initial-circle avatar — first letter of preferred/first name, else email.
  const initial = (user.preferred_name ?? user.first_name ?? user.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="flex items-start gap-5">
      <div
        className="flex items-center justify-center shrink-0 rounded-full font-bold text-2xl"
        style={{
          width: 72,
          height: 72,
          background: "hsl(42 95% 55% / 0.12)",
          border: "1px solid hsl(42 95% 55% / 0.3)",
          color: "hsl(42 95% 65%)",
        }}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="page-eyebrow">{eyebrow}</p>
        <h1 className="page-title truncate">{name}</h1>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
          <span className="truncate">{user.email ?? "—"}</span>
          {user.job_title && (
            <>
              <span className="opacity-50">·</span>
              <span>{user.job_title}</span>
            </>
          )}
          <span className="opacity-50">·</span>
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "0.1em",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 7px",
              borderRadius: "4px",
              background: s.bg,
              color: s.fg,
            }}
          >
            {s.label}
          </span>
        </div>
      </div>
    </div>
  );
}
