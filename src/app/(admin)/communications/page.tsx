import { Mail } from "lucide-react";

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="page-eyebrow">ANNOUNCEMENTS &amp; OUTREACH</p>
        <h1 className="page-title">Communications</h1>
      </div>

      <div className="surface-2 rounded-xl border border-white/[0.06] p-10 text-center">
        <Mail className="h-10 w-10 mx-auto mb-4 opacity-40" />
        <p className="font-semibold text-white mb-2 uppercase tracking-widest text-sm">Coming Soon</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The Communications module is under development. It will handle
          internal announcements, partner update tracking, email/SMS
          campaigns, and communication history for staff and supporters.
        </p>
      </div>
    </div>
  );
}
