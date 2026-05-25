import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/services/users";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ProfileRecords } from "@/components/profile-records";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: user } = await getCurrentUser(supabase);

  if (!user) redirect("/login");

  const roles = user.user_roles ?? [];

  const initial = (
    user.preferred_name ??
    user.first_name ??
    user.email ??
    "?"
  )
    .trim()
    .charAt(0)
    .toUpperCase();

  const fullName =
    [user.preferred_name ?? user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ") || user.email || "Profile";

  return (
    <div className="space-y-8">
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
          <p className="page-eyebrow">MY PROFILE</p>
          <h1 className="page-title truncate">{fullName}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {user.email ?? "—"}
            {user.preferred_name &&
              user.first_name &&
              user.preferred_name !== user.first_name && (
                <>
                  <span className="opacity-50"> · </span>
                  legal name {user.first_name} {user.last_name}
                </>
              )}
          </div>
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {roles.map(
                (ur: {
                  id: string;
                  scope_type: string | null;
                  scope_id: string | null;
                  roles: { display_name: string } | null;
                }) => (
                  <Badge key={ur.id} variant="secondary">
                    {ur.roles?.display_name ?? "Unknown"}
                    {ur.scope_type && (
                      <span className="ml-1 opacity-60">
                        ({ur.scope_type})
                      </span>
                    )}
                  </Badge>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Personal">
          <InfoRow
            label="Date of birth"
            value={user.date_of_birth ?? "—"}
          />
          <InfoRow label="Nationality" value={user.nationality ?? "—"} />
        </InfoCard>

        <InfoCard title="Contact">
          <InfoRow label="Email" value={user.email ?? "—"} />
          <InfoRow label="Phone" value={user.phone ?? "—"} />
        </InfoCard>

        <InfoCard title="Address">
          {addressLines(user).length > 0 ? (
            <div className="space-y-0.5 text-sm">
              {addressLines(user).map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No address on file.
            </p>
          )}
        </InfoCard>
      </section>

      <section className="space-y-3">
        <div>
          <p className="page-eyebrow">RECORDS ON FILE</p>
          <h2 className="text-xl font-semibold">Your attached history</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Past applications, schools attended, payments and documents we
            have on file for you.
          </p>
        </div>
        <ProfileRecords userId={user.id} canOpenLibrary={false} />
      </section>
    </div>
  );
}

function addressLines(u: {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string[] {
  return [
    u.address_line_1,
    u.address_line_2,
    [u.city, u.province].filter(Boolean).join(", "),
    u.postal_code,
    u.country,
  ].filter((s): s is string => !!s && s.length > 0);
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm mt-0.5">{value}</div>
    </div>
  );
}
