import { createClient } from "@/lib/supabase/server";
import { getRoles } from "@/services/roles";
import type { Role } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function RolesPage() {
  const supabase = await createClient();
  const { data: roles } = await getRoles(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
        <p className="text-sm text-muted-foreground">
          System role definitions. Roles are assigned to users to control access.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>System</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!roles || roles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  No roles found. Run the seed migration to create default roles.
                </TableCell>
              </TableRow>
            ) : (
              (roles as Role[]).map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    {role.display_name}
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {role.name}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-md">
                    {role.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    {role.is_system && (
                      <Badge variant="outline" className="text-xs">
                        System
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
