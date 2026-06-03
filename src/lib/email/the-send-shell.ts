// ============================================================
// THE SEND email shell — bespoke brand chrome
// ============================================================
// Wrapper + content helpers for every email tied to an event
// with brand='the_send'. Sibling to:
//   - shell.ts          (Fire & Fragrance transactional shell)
//   - ff-email-shell.ts (Fire & Fragrance scheduling shell)
//   - workflow-template.ts (F&F workflow-step shell with blocks)
//
// THE SEND identity (see the-send-ticket-confirmation.ts and the
// storefront for the source of truth):
//   - palette: navy + cream + gold + red + blue
//   - display: Arial Black (uppercase, tight tracking)
//   - body:    Helvetica
//   - mono:    Courier New
//   - chrome:  yellow ticker bar → navy masthead → cream paper body
//              → navy footer with the F&F wordmark and the SEND lockup
//
// All inline-CSS, single 600px table — Gmail / Outlook / Apple Mail
// safe. No webfonts (Anton / Bebas Neue don't load in clients), only
// system fallbacks.
// ============================================================

// Mirrors the structured-shell signature used by F&F's renderEmailShell
// (./shell.ts) so callers can swap between the two when an event-tied
// transactional template needs to brand-route. Duplicated here rather
// than imported so this file can stand on its own — shell.ts is still
// being refactored separately.
interface EmailShellOptions {
  title?: string;
  preheader?: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  tagline?: string | null;
  siteUrl?: string | null;
}

// ── Tokens ──────────────────────────────────────────────────
export const SEND_COLORS = {
  GOLD: "#FACF50",
  CREAM: "#F7F1E8",
  RED: "#FA0015",
  BLUE: "#1535C6",
  NAVY: "#1C314C",
  INK: "#0E1A2B",
  WHITE: "#FFFFFF",
} as const;

const C = SEND_COLORS;

export const SEND_FONTS = {
  DISPLAY: "'Arial Black','Helvetica Neue',Arial,sans-serif",
  BODY: "Helvetica,Arial,sans-serif",
  MONO: "'Courier New',Courier,monospace",
} as const;

const F = SEND_FONTS;

const DEFAULT_SITE_URL = "https://www.ffsahub.com";

function siteBase(siteUrl?: string | null): string {
  const raw =
    siteUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function sendEsc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Content helpers ─────────────────────────────────────────
// Plain-text args are escaped. *Html() variants take pre-escaped HTML
// (sanitised upstream) so caller can splice <strong> / <em> / <a> in.

export function sendEyebrow(text: string): string {
  return `<p style="margin:0 0 10px;font-family:${F.MONO};font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.BLUE};">// ${sendEsc(text)}</p>`;
}

export function sendHeading(htmlOrText: string, opts?: { raw?: boolean }): string {
  const content = opts?.raw ? htmlOrText : sendEsc(htmlOrText);
  return `<h1 style="margin:0 0 18px;font-family:${F.DISPLAY};font-size:34px;line-height:1.05;font-weight:900;letter-spacing:0.005em;text-transform:uppercase;color:${C.NAVY};">${content}</h1>`;
}

export function sendParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${F.BODY};font-size:15px;line-height:1.65;color:${C.NAVY};">${html}</p>`;
}

export function sendStrongLine(text: string): string {
  return `<p style="margin:0 0 18px;font-family:${F.DISPLAY};font-size:20px;font-weight:900;letter-spacing:0.005em;text-transform:uppercase;color:${C.NAVY};">${sendEsc(text)}</p>`;
}

export function sendQuote(text: string, attribution?: string | null): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;"><tr><td style="border-left:4px solid ${C.GOLD};padding:2px 0 2px 16px;font-family:${F.BODY};font-size:17px;line-height:1.55;font-style:italic;color:${C.NAVY};">&ldquo;${sendEsc(text)}&rdquo;${
    attribution
      ? `<span style="display:block;margin-top:8px;font-family:${F.MONO};font-size:11px;font-style:normal;letter-spacing:0.08em;text-transform:uppercase;color:${C.BLUE};">&mdash; ${sendEsc(attribution)}</span>`
      : ""
  }</td></tr></table>`;
}

export function sendButton(
  url: string,
  label: string,
  variant: "filled" | "outline" | "link" = "filled"
): string {
  if (variant === "link") {
    return `<p style="margin:6px 0 18px;"><a href="${sendEsc(url)}" style="font-family:${F.BODY};font-size:15px;font-weight:700;color:${C.NAVY};text-decoration:underline;text-decoration-color:${C.GOLD};">${sendEsc(label)} &rarr;</a></p>`;
  }
  const outline = variant === "outline";
  const bg = outline ? C.CREAM : C.NAVY;
  const fg = outline ? C.NAVY : C.CREAM;
  const border = `2px solid ${C.NAVY}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="background:${bg};border:${border};">
<a href="${sendEsc(url)}" style="display:inline-block;padding:13px 30px;font-family:${F.DISPLAY};font-size:13px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:${fg};text-decoration:none;">${sendEsc(label)}</a>
</td></tr></table>`;
}

export function sendList(items: string[]): string {
  const rows = items
    .map(
      (it) =>
        `<tr><td style="padding:10px 14px;border:2px solid ${C.NAVY};background:${C.CREAM};font-family:${F.BODY};font-size:14px;color:${C.NAVY};">${sendEsc(it)}</td></tr><tr><td style="height:7px;line-height:7px;font-size:0;">&nbsp;</td></tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:2px 0 14px;">${rows}</table>`;
}

export function sendDivider(style: "rule" | "dots" | "space" = "rule"): string {
  if (style === "space") {
    return `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>`;
  }
  if (style === "dots") {
    return `<p style="margin:14px 0;text-align:center;font-family:${F.MONO};font-size:16px;letter-spacing:0.4em;color:${C.RED};">&middot;&nbsp;&middot;&nbsp;&middot;</p>`;
  }
  return `<div style="margin:20px 0;border-top:2px dashed ${C.NAVY};line-height:0;font-size:0;">&nbsp;</div>`;
}

export function sendSpacer(size: "sm" | "md" | "lg" | "xl" = "md"): string {
  const h = { sm: 8, md: 16, lg: 28, xl: 44 }[size];
  return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
}

export function sendImage(url: string, alt: string, caption?: string | null): string {
  return `<p style="margin:0 0 16px;"><img src="${sendEsc(url)}" alt="${sendEsc(alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:2px solid ${C.NAVY};" />${
    caption
      ? `<span style="display:block;margin-top:6px;font-family:${F.MONO};font-size:11px;color:${C.BLUE};">// ${sendEsc(caption)}</span>`
      : ""
  }</p>`;
}

// ── Chrome ──────────────────────────────────────────────────
// The outer wrapper. Caller renders bodyHtml (eyebrow/heading/body/
// blocks/etc) and gets back a full <!doctype html> document.
//
// Same layout as the ticket-confirmation hero card (ticker → masthead
// → cream body → navy footer), but the body slot is generic so
// transactional copy, workflow blocks, or ticket stubs all use the
// same chrome.

export interface TheSendChromeOptions {
  /** Browser-tab title. Defaults to "THE SEND". */
  title?: string;
  /** Hidden inbox-preview text (Gmail/iOS). */
  previewText?: string;
  /** Pre-rendered inner HTML for the cream-paper body slot. */
  bodyHtml: string;
  /** Used to build absolute URLs for the wordmark image. */
  siteUrl?: string | null;
}

export function theSendChrome(opts: TheSendChromeOptions): string {
  const base = siteBase(opts.siteUrl);
  const title = opts.title ?? "THE SEND";
  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.INK};">${sendEsc(opts.previewText)}</div>`
    : "";

  // Ticker matches the ticket template; sized to fit the 600px table.
  const ticker = `<span style="color:${C.RED};">&rarr;</span>&nbsp;THE WAR ON INACTION HAS BEGUN&nbsp;<span style="color:${C.RED};">&rarr;</span>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${sendEsc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.INK};font-family:${F.BODY};color:${C.NAVY};">
  ${preview}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.INK};padding:30px 10px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:${C.CREAM};border:3px solid ${C.NAVY};table-layout:fixed;">

        <!-- Yellow ticker bar -->
        <tr>
          <td style="background:${C.GOLD};border-bottom:3px solid ${C.NAVY};padding:8px 14px;font-family:${F.DISPLAY};font-size:13px;font-weight:900;color:${C.NAVY};letter-spacing:0.14em;text-transform:uppercase;line-height:1.2;overflow:hidden;white-space:nowrap;">
            ${ticker}
          </td>
        </tr>

        <!-- Navy masthead -->
        <tr>
          <td style="background:${C.NAVY};padding:14px 20px;border-bottom:3px solid ${C.GOLD};">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td valign="middle" style="font-family:${F.DISPLAY};font-size:22px;font-weight:900;color:${C.GOLD};letter-spacing:-0.01em;text-transform:uppercase;line-height:1;">
                  THE&nbsp;SEND&nbsp;<span style="font-family:${F.BODY};font-size:20px;color:${C.GOLD};">&#10140;</span>
                </td>
                <td valign="middle" align="right" style="font-family:${F.MONO};font-size:10px;color:${C.CREAM};letter-spacing:0.2em;text-transform:uppercase;">
                  SOUTH&nbsp;AFRICA / MMXXVI
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cream body — caller-supplied content -->
        <tr>
          <td style="background:${C.CREAM};color:${C.NAVY};padding:34px 28px 28px 28px;">
            ${opts.bodyHtml}
          </td>
        </tr>

        <!-- Navy footer -->
        <tr>
          <td style="background:${C.NAVY};color:${C.CREAM};padding:26px 28px;text-align:center;">
            <p style="margin:0;font-family:${F.DISPLAY};font-size:24px;font-weight:900;color:${C.GOLD};letter-spacing:-0.01em;text-transform:uppercase;line-height:1;">
              THE&nbsp;SEND&nbsp;<span style="font-family:${F.BODY};font-size:22px;">&#10140;</span>
            </p>
            <p style="margin:14px 0 10px 0;">
              <img
                src="${base}/brand/ff-wordmark-white@email.png"
                alt="Fire &amp; Fragrance"
                width="150"
                height="18"
                style="display:inline-block;width:150px;height:auto;opacity:0.85;"
              />
            </p>
            <p style="margin:0;font-family:${F.MONO};font-size:10px;color:${C.CREAM};letter-spacing:0.2em;text-transform:uppercase;opacity:0.85;">
              Powered by FFSA Hub &middot; &copy;&nbsp;MMXXVI
            </p>
            <p style="margin:8px 0 0 0;font-family:${F.MONO};font-size:9px;color:${C.GOLD};letter-spacing:0.24em;text-transform:uppercase;opacity:0.7;">
              For External Use &mdash; Distribute Freely
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Transactional shell ─────────────────────────────────────
// Matches the EmailShellOptions signature from ./shell so callers
// can swap between renderEmailShell and theSendEmailShell without
// changing the per-template glue code. Eyebrow / heading / bodyHtml
// / cta render in SEND aesthetic inside theSendChrome.

export function theSendEmailShell(opts: EmailShellOptions): string {
  const eyebrow = opts.eyebrow ? sendEyebrow(opts.eyebrow) : "";
  // Heading from EmailShellOptions may contain literal "<br/>" — keep it.
  const heading = sendHeading(opts.heading, { raw: true });
  const ctaHtml = opts.cta ? sendButton(opts.cta.url, opts.cta.label, "filled") : "";

  const bodyHtml = `${eyebrow}${heading}${opts.bodyHtml}${ctaHtml}`;

  return theSendChrome({
    title: opts.title ?? opts.eyebrow,
    previewText: opts.preheader ?? opts.eyebrow,
    bodyHtml,
    siteUrl: opts.siteUrl,
  });
}
