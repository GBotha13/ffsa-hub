import { createAdminClient } from "@/lib/supabase/admin";
import { getSchedulingRequestByToken } from "@/services/scheduling";
import { SlotPicker } from "./slot-picker";

const SHELL = {
  bg: "#0D0B09",
  card: "#141210",
  border: "#2a2420",
  text: "#F0EBE3",
  textDim: "#B8A898",
  yellow: "#F5C518",
};

function NoticePage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: SHELL.bg }}
    >
      <div className="text-center max-w-md">
        <h1
          style={{
            fontFamily: "var(--font-bebas, 'Arial Black', sans-serif)",
            fontSize: "2rem",
            color: SHELL.text,
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </h1>
        <p className="text-sm mt-2" style={{ color: SHELL.textDim }}>
          {body}
        </p>
      </div>
    </div>
  );
}

function fullName(p: {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
}): string {
  const first = p.preferred_name || p.first_name || "";
  const last = p.last_name || "";
  return `${first} ${last}`.trim();
}

export default async function SchedulingTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const adminSupabase = createAdminClient();
  const view = await getSchedulingRequestByToken(adminSupabase, token);

  if (!view) {
    return (
      <NoticePage
        title="Invalid link"
        body="This scheduling link is invalid. Please contact the sender for a new link."
      />
    );
  }

  if (view.request.status === "cancelled") {
    return (
      <NoticePage
        title="Cancelled"
        body="This scheduling request has been cancelled."
      />
    );
  }

  if (view.request.status === "scheduled") {
    return (
      <NoticePage
        title="Already confirmed"
        body="A time has already been confirmed for this request — check your email for the calendar invite."
      />
    );
  }

  if (view.request.status === "awaiting_selection") {
    return (
      <NoticePage
        title="Times submitted"
        body="You've already submitted your availability. We'll email you once a time is confirmed."
      />
    );
  }

  if (view.expired) {
    return (
      <NoticePage
        title="Link expired"
        body="This scheduling link has expired. Please reach out to the sender for a new link."
      />
    );
  }

  const recipientFirstName =
    view.contact.preferred_name || view.contact.first_name || "there";
  const senderName = fullName(view.requester) || "Fire & Fragrance South Africa";

  return (
    <SlotPicker
      token={token}
      recipientFirstName={recipientFirstName}
      senderName={senderName}
      durationMinutes={view.request.duration_minutes}
      message={view.request.message}
    />
  );
}
