import { AvatarUploader } from "@/components/avatar-uploader";

/**
 * Identity header shared between the Profile and Permissions tabs.
 * The avatar is rendered via AvatarUploader so admins can change the
 * user's photo inline. The API enforces the actual permission check
 * (self or super_admin/admin), so it's safe to mount the uploader on
 * every admin viewer — non-admins viewing this page is already
 * blocked upstream in /users/[id]/page.tsx.
 */
export function UserHeader({
  user,
  eyebrow,
}: {
  user: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    preferred_name?: string | null;
    display_name?: string | null;
    email?: string | null;
    job_title?: string | null;
    status?: string | null;
    avatar_url?: string | null;
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

  const avatarName =
    user.preferred_name ?? user.first_name ?? user.email ?? "?";

  return (
    <div className="flex items-start gap-5">
      <AvatarUploader
        userId={user.id}
        initialSrc={user.avatar_url}
        name={avatarName}
        size={72}
      />
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
