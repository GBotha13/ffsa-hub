import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { getUserById } from "@/services/users";
import { getSchoolsManageScopes } from "@/lib/auth/schools-manage-scopes";
import { ProfileRecords } from "@/components/profile-records";
import { UserHeader } from "./user-header";
import { UserTabs } from "./user-tabs";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  // Profile view is open to:
  //   - The user themselves (redirect to /profile for the personal view)
  //   - super_admin, admin
  //   - anyone with users.read or schools.manage (uses isAdmin OR scope check)
  // For simplicity and consistency with the rest of the admin area, we keep
  // the same gate the old page used and add the user themselves as well.
  if (authUser.id === id) {
    redirect("/profile");
  }

  const { data: superCheck } = await supabase
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", authUser.id)
    .in("roles.name", ["super_admin", "admin"])
    .limit(1);
  const isAdmin = (superCheck?.length ?? 0) > 0;

  const manageScopes = isAdmin
    ? { hasGlobal: true, programIds: [] }
    : await getSchoolsManageScopes(supabase, authUser.id);

  const canManagePermissions =
    isAdmin || manageScopes.hasGlobal || manageScopes.programIds.length > 0;

  if (!canManagePermissions) redirect("/dashboard");

  const { data: targetUser, error } = await getUserById(supabase, id);
  if (error || !targetUser) notFound();

  return (
    <div className="space-y-6">
      <UserHeader user={targetUser} eyebrow="STAFF PROFILE" />
      <UserTabs
        userId={id}
        active="profile"
        showPermissions={canManagePermissions}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Personal">
          <InfoRow label="Legal name" value={legalName(targetUser)} />
          <InfoRow
            label="Preferred name"
            value={targetUser.preferred_name ?? "—"}
          />
          <InfoRow
            label="Date of birth"
            value={targetUser.date_of_birth ?? "—"}
          />
          <InfoRow
            label="Nationality"
            value={targetUser.nationality ?? "—"}
          />
        </InfoCard>

        <InfoCard title="Contact">
          <InfoRow label="Email" value={targetUser.email ?? "—"} />
          <InfoRow label="Phone" value={targetUser.phone ?? "—"} />
          <InfoRow
            label="Job title"
            value={targetUser.job_title ?? "—"}
          />
        </InfoCard>

        <InfoCard title="Address">
          {addressLines(targetUser).length > 0 ? (
            <div className="space-y-0.5 text-sm">
              {addressLines(targetUser).map((line) => (
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
        <div className="flex items-end justify-between">
          <div>
            <p className="page-eyebrow">RECORDS ON FILE</p>
            <h2 className="text-xl font-semibold">Attached history</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-linked from CSV imports via the Records Library matching engine.
          </p>
        </div>
        <ProfileRecords userId={id} canOpenLibrary={true} />
      </section>
    </div>
  );
}

function legalName(u: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const parts = [u.first_name, u.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "—";
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
