import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/services/users";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: user } = await getCurrentUser(supabase);

  if (!user) redirect("/login");

  const roles = user.user_roles ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your personal information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {user.preferred_name ?? user.first_name} {user.last_name}
          </CardTitle>
          {user.preferred_name && (
            <CardDescription>
              Legal name: {user.first_name} {user.last_name}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{user.email ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="text-sm">{user.phone ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Date of Birth
              </p>
              <p className="text-sm">{user.date_of_birth ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Nationality
              </p>
              <p className="text-sm">{user.nationality ?? "Not provided"}</p>
            </div>
          </div>

          {(user.address_line_1 || user.city || user.country) && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Address
              </p>
              <p className="text-sm">
                {[
                  user.address_line_1,
                  user.address_line_2,
                  [user.city, user.province].filter(Boolean).join(", "),
                  user.postal_code,
                  user.country,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
