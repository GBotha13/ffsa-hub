// Mailtrap "Email Sending" API wrapper — used for marketing campaigns.
// Transactional system email continues to go through Resend; Mailtrap is
// the marketing/broadcast channel per the CRM spec.

const MAILTRAP_BULK_URL = "https://bulk.api.mailtrap.io/api/send";

export type MailtrapSendInput = {
  fromEmail: string;
  fromName: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  category?: string;
};

export type MailtrapSendResult = {
  messageId: string | null;
  error: string | null;
};

/** Send a single email through Mailtrap. Never throws — returns an error string. */
export async function sendViaMailtrap(
  input: MailtrapSendInput
): Promise<MailtrapSendResult> {
  const token = process.env.MAILTRAP_API_TOKEN;
  if (!token) {
    return { messageId: null, error: "MAILTRAP_API_TOKEN is not configured" };
  }

  try {
    const res = await fetch(MAILTRAP_BULK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Token": token,
      },
      body: JSON.stringify({
        from: { email: input.fromEmail, name: input.fromName },
        to: [{ email: input.to }],
        ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
        subject: input.subject,
        html: input.html,
        ...(input.category ? { category: input.category } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        messageId: null,
        error: `Mailtrap ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as {
      message_ids?: string[];
      success?: boolean;
    };
    return { messageId: data.message_ids?.[0] ?? null, error: null };
  } catch (e) {
    return {
      messageId: null,
      error: e instanceof Error ? e.message : "Mailtrap request failed",
    };
  }
}
