import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MissionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mission</h1>
        <p className="text-sm text-muted-foreground">
          Outreach trips, visiting teams, and impact statistics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <Globe className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The Mission module is under development. It will track outreach
            trips, visiting teams, and ministry impact statistics including
            salvations, healings, gospel seeds, bibles distributed, and hours
            of prayer across all FFSA ministry activities.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
