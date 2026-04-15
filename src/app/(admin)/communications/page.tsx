import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
        <p className="text-sm text-muted-foreground">
          Announcements, partner updates, and internal communications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <Mail className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The Communications module is under development. It will handle
            internal announcements, partner update tracking, email/SMS
            campaigns, and communication history for staff and supporters.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
