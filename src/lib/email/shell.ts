// Shared branded email shell for FFSA Hub transactional emails.
//
// All "standard" templates (applications, references, invites, staff
// notifications, enrollment) compose their body through `renderEmailShell`
// so the FF wordmark, accent rail, footer, and dark cinematic aesthetic
// stay consistent across every send.
//
// Bespoke event templates (THE SEND, generic ticket confirmation) keep
// their own layouts — they only borrow the colour tokens below.

export const EMAIL_COLORS = {
  BG: "#0D0B09",        // page background — matches admin shell
  CARD: "#141210",      // card surface
  BORDER: "#2a2420",    // hairline border
  TEXT: "#F0EBE3",      // primary text
  TEXT_DIM: "#B8A898",  // body text
  TEXT_DIMMER: "#7a6e64", // caption text
  TEXT_FAINT: "#3a3028", // footer text
  YELLOW: "#F5C518",    // brand-accent yellow
} as const;

const DEFAULT_SITE_URL = "https://ffsahub.com";

function siteBase(siteUrl?: string | null): string {
  const raw = siteUrl?.trim() || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailCta {
  label: string;
  url: string;
}

export interface EmailShellOptions {
  /** Browser tab title. Defaults to the eyebrow. */
  title?: string;
  /** Hidden inbox-preview text (Gmail/iOS). */
  preheader?: string;
  /** Small uppercase label above the heading. */
  eyebrow: string;
  /** Main heading. Supports a single `<br/>` if needed. */
  heading: string;
  /** Raw inner HTML for the body — sanitise upstream. */
  bodyHtml: string;
  /** Optional primary call-to-action button. */
  cta?: EmailCta;
  /** Footer tagline. Defaults to FFSA mission line. */
  tagline?: string | null;
  /** Used to build absolute URLs for embedded brand images. */
  siteUrl?: string | null;
}

/**
 * Renders the full branded email HTML around the given body content.
 *
 * Inline CSS + table-based layout for broad email-client support
 * (Gmail web/iOS/Android, Apple Mail, Outlook desktop, Yahoo).
 */
export function renderEmailShell(opts: EmailShellOptions): string {
  const base = siteBase(opts.siteUrl);
  const C = EMAIL_COLORS;
  const wordmarkSrc = `${base}/brand/ff-wordmark-white@email.png`;
  const tagline = opts.tagline === undefined
    ? "CATALYSE A GENERATION · EVANGELISE THE WORLD"
    : opts.tagline;
  const title = opts.title ?? opts.eyebrow;
  const preheader = opts.preheader ?? "";

  const ctaHtml = opts.cta ? `
              <table cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
                <tr>
                  <td align="center" style="background:${C.YELLOW};border-radius:8px;">
                    <a href="${escapeHtml(opts.cta.url)}"
                       style="display:inline-block;padding:14px 36px;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.BG};text-decoration:none;font-family:Arial,sans-serif;">
                      ${escapeHtml(opts.cta.label)}
                    </a>
                  </td>
                </tr>
              </table>` : "";

  const taglineHtml = tagline ? `
              <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.25em;color:${C.TEXT_FAINT};text-transform:uppercase;font-weight:700;">
                ${escapeHtml(tagline)}
              </p>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.BG};font-family:'Roboto',Arial,sans-serif;">

  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.BG};">${escapeHtml(preheader)}</div>` : ""}

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.BG};padding:48px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${C.CARD};border:1px solid ${C.BORDER};border-radius:14px;overflow:hidden;">

          <!-- Top accent rail -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,transparent,${C.YELLOW},transparent);line-height:3px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Brand header — FF wordmark + HUB lockup -->
          <tr>
            <td align="center" style="padding:40px 40px 28px;">
              <img
                src="${wordmarkSrc}"
                alt="Fire &amp; Fragrance"
                width="220"
                height="26"
                style="display:block;margin:0 auto;width:220px;height:auto;max-width:60%;"
              />
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px auto 0;">
                <tr>
                  <td style="padding-right:8px;">
                    <span style="display:inline-block;width:18px;height:1px;background:${C.YELLOW};vertical-align:middle;line-height:1px;font-size:0;">&nbsp;</span>
                  </td>
                  <td>
                    <span style="font-size:9px;letter-spacing:0.3em;font-weight:700;color:${C.YELLOW};text-transform:uppercase;font-family:Arial,sans-serif;">South Africa &middot; Hub</span>
                  </td>
                  <td style="padding-left:8px;">
                    <span style="display:inline-block;width:18px;height:1px;background:${C.YELLOW};vertical-align:middle;line-height:1px;font-size:0;">&nbsp;</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:1px;background:${C.BORDER};line-height:1px;font-size:0;">&nbsp;</td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 36px;">

              <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.25em;font-weight:700;color:${C.YELLOW};text-transform:uppercase;">
                ${escapeHtml(opts.eyebrow)}
              </p>

              <h1 style="margin:0 0 22px;font-size:28px;font-weight:900;letter-spacing:0.03em;color:${C.TEXT};font-family:'Arial Black',Arial,sans-serif;line-height:1.15;">
                ${opts.heading}
              </h1>

              ${opts.bodyHtml}

              ${ctaHtml}

            </td>
          </tr>

          <tr><td style="height:1px;background:${C.BORDER};line-height:1px;font-size:0;">&nbsp;</td></tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 40px 28px;">
              ${taglineHtml}
              <p style="margin:0;font-size:11px;color:${C.TEXT_FAINT};font-family:Arial,sans-serif;">
                Fire &amp; Fragrance South Africa &mdash; <a href="${base}" style="color:${C.TEXT_FAINT};text-decoration:none;">ffsahub.com</a>
              </p>
            </td>
          </tr>

          <!-- Bottom accent rail -->
          <tr>
            <td style="height:2px;background:linear-gradient(90deg,transparent,${C.BORDER},transparent);line-height:2px;font-size:0;">&nbsp;</td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Convenience helper for body paragraphs in the dimmed brand colour.
 * Use inside `bodyHtml` so tone stays consistent.
 */
export function bodyParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;color:${EMAIL_COLORS.TEXT_DIM};line-height:1.65;">${html}</p>`;
}

/** Strong inline highlight that matches body copy. */
export function emphasis(html: string): string {
  return `<strong style="color:${EMAIL_COLORS.TEXT};">${html}</strong>`;
}
