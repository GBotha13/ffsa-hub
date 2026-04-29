import { Globe } from "lucide-react";

export default function MyMissionPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">OUTREACH &amp; IMPACT</p>
        <h1 className="page-title">My Mission</h1>
      </div>

      <div className="surface-2 rounded-xl border border-white/[0.06] p-10 text-center">
        <Globe className="h-10 w-10 mx-auto mb-4 opacity-40" />
        <p className="font-semibold text-white mb-2 uppercase tracking-widest text-sm">Coming Soon</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your mission view is under development. You will be able to see your
          outreach trip history and the ministry statistics you have
          contributed — salvations, healings, gospel seeds, bibles distributed,
          and more.
        </p>
      </div>
    </div>
  );
}
