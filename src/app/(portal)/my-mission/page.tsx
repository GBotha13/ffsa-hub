import { Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyMissionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mission</h1>
        <p className="text-sm text-muted-foreground">
          Your outreach trips and impact statistics
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
            Your mission view is under development. You will be able to see your
            outreach trip history and the ministry statistics you have
            contributed — salvations, healings, gospel seeds, bibles distributed,
            and more.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
