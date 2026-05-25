import Link from "next/link";

/**
 * Top-of-page nav for the /users/[id]/* routes. Profile is visible to
 * everyone with view access; Permissions is only shown if the viewer
 * can manage permissions (super_admin or schools.manage holder).
 */
export function UserTabs({
  userId,
  active,
  showPermissions,
}: {
  userId: string;
  active: "profile" | "permissions";
  showPermissions: boolean;
}) {
  const tabs: { key: "profile" | "permissions"; label: string; href: string }[] = [
    { key: "profile", label: "Profile", href: `/users/${userId}` },
  ];
  if (showPermissions) {
    tabs.push({
      key: "permissions",
      label: "Permissions",
      href: `/users/${userId}/permissions`,
    });
  }

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? "border-blue-500 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
