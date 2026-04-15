import { UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          Ministry teams, outreach teams, and departments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <UsersRound className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The Teams module is under development. It will manage ministry and
            outreach team rosters, department structure, and team leadership for
            all FFSA ministries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
