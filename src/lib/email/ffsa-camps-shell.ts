// ============================================================
// FFSA CAMPS email shell — bespoke brand chrome
// ============================================================
// Wrapper + content helpers for every email tied to an event
// with brand='ffsa_camps'. Sibling to:
//   - shell.ts          (Fire & Fragrance transactional shell)
//   - the-send-shell.ts (THE SEND bespoke shell)
//   - workflow-template.ts (per-brand workflow-step shells)
//
// FFSA CAMPS identity (see ffsa-camps-ticket-confirmation.ts and the
// camps storefront for the source of truth):
//   - palette: bright blue + cream, deep-ink surround, white pop
//   - display: heavy *italic* sans (Aileron → Helvetica/Arial fallback),
//              uppercase, tight tracking. The italic is the FFSA Camps
//              signature — distinct from THE SEND's upright Arial Black.
//   - body:    Helvetica
//   - NO mono device (that's THE SEND's identity) — eyebrows are clean
//     uppercase letter-spaced sans in blue.
//   - chrome:  ink surround → blue ticker ("PERMISSION GRANTED") → blue
//              masthead (FFSA CAMPS lockup) → cream paper body → blue
//              footer with the lockup + vision line.
//   - slogan:  "PERMISSION GRANTED"
//   - vision:  "activating the everyday christian in south africa to see
//              the great commission fulfilled"
//
// All inline-CSS, single 600px table — Gmail / Outlook / Apple Mail
// safe. No webfonts (Aileron won't load in clients), only system
// fallbacks. The 'Aileron' family is kept first in the stack so the
// real face is used the day it's self-hosted.
// ============================================================

// Mirrors the structured-shell signature used by F&F's renderEmailShell
// (./shell.ts) and theSendEmailShell so callers can swap between the
// three when an event-tied transactional template needs to brand-route.
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
export const CAMPS_COLORS = {
  BLUE: "#2F65E8", // primary — ticker, masthead, headings, buttons
  CREAM: "#F2E8CC", // paper body
  WHITE: "#FFFFFF", // elevated (QR backdrop, input fields)
  INK: "#14224A", // deep blue — body text + surround
  SKY: "#E4ECFD", // light blue tint — subtle fills
} as const;

const C = CAMPS_COLORS;

export const CAMPS_FONTS = {
  // DISPLAY is used together with `font-style:italic;font-weight:900`
  // at each call site (the italic is the brand signature).
  DISPLAY: "'Aileron','Helvetica Neue',Arial,sans-serif",
  BODY: "Helvetica,Arial,sans-serif",
} as const;

const F = CAMPS_FONTS;

// Slogan + vision are the FFSA Camps analog of THE SEND's ticker line.
export const CAMPS_SLOGAN = "PERMISSION GRANTED";
export const CAMPS_VISION =
  "Activating the everyday Christian in South Africa to see the Great Commission fulfilled.";

const DEFAULT_SITE_URL = "https://www.ffsahub.com";

function siteBase(siteUrl?: string | null): string {
  const raw =
    siteUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

export function campsEsc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Heavy italic display style shared by every headline-level element.
const DISPLAY_STYLE = `font-family:${F.DISPLAY};font-style:italic;font-weight:900;`;

// ── Content helpers ─────────────────────────────────────────
// Plain-text args are escaped. *Html() variants take pre-escaped HTML
// (sanitised upstream) so caller can splice <strong> / <em> / <a> in.

export function campsEyebrow(text: string): string {
  return `<p style="margin:0 0 10px;font-family:${F.BODY};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${C.BLUE};">${campsEsc(text)}</p>`;
}

export function campsHeading(htmlOrText: string, opts?: { raw?: boolean }): string {
  const content = opts?.raw ? htmlOrText : campsEsc(htmlOrText);
  return `<h1 style="margin:0 0 18px;${DISPLAY_STYLE}font-size:34px;line-height:1.02;letter-spacing:0.005em;text-transform:uppercase;color:${C.INK};">${content}</h1>`;
}

export function campsParagraph(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${F.BODY};font-size:15px;line-height:1.65;color:${C.INK};">${html}</p>`;
}

export function campsStrongLine(text: string): string {
  return `<p style="margin:0 0 18px;${DISPLAY_STYLE}font-size:20px;letter-spacing:0.005em;text-transform:uppercase;color:${C.BLUE};">${campsEsc(text)}</p>`;
}

export function campsQuote(text: string, attribution?: string | null): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;"><tr><td style="border-left:4px solid ${C.BLUE};padding:2px 0 2px 16px;font-family:${F.BODY};font-size:17px;line-height:1.55;font-style:italic;color:${C.INK};">&ldquo;${campsEsc(text)}&rdquo;${
    attribution
      ? `<span style="display:block;margin-top:8px;font-family:${F.BODY};font-size:11px;font-style:normal;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.BLUE};">&mdash; ${campsEsc(attribution)}</span>`
      : ""
  }</td></tr></table>`;
}

export function campsButton(
  url: string,
  label: string,
  variant: "filled" | "outline" | "link" = "filled"
): string {
  if (variant === "link") {
    return `<p style="margin:6px 0 18px;"><a href="${campsEsc(url)}" style="font-family:${F.BODY};font-size:15px;font-weight:700;color:${C.BLUE};text-decoration:underline;text-decoration-color:${C.BLUE};">${campsEsc(label)} &rarr;</a></p>`;
  }
  const outline = variant === "outline";
  const bg = outline ? C.CREAM : C.BLUE;
  const fg = outline ? C.BLUE : C.WHITE;
  const border = `2px solid ${C.BLUE}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="background:${bg};border:${border};">
<a href="${campsEsc(url)}" style="display:inline-block;padding:13px 30px;${DISPLAY_STYLE}font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:${fg};text-decoration:none;">${campsEsc(label)}</a>
</td></tr></table>`;
}

export function campsList(items: string[]): string {
  const rows = items
    .map(
      (it) =>
        `<tr><td style="padding:10px 14px;border:2px solid ${C.BLUE};background:${C.WHITE};font-family:${F.BODY};font-size:14px;color:${C.INK};">${campsEsc(it)}</td></tr><tr><td style="height:7px;line-height:7px;font-size:0;">&nbsp;</td></tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:2px 0 14px;">${rows}</table>`;
}

export function campsDivider(style: "rule" | "dots" | "space" = "rule"): string {
  if (style === "space") {
    return `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>`;
  }
  if (style === "dots") {
    return `<p style="margin:14px 0;text-align:center;font-family:${F.BODY};font-size:16px;letter-spacing:0.4em;color:${C.BLUE};">&bull;&nbsp;&bull;&nbsp;&bull;</p>`;
  }
  return `<div style="margin:20px 0;border-top:2px dashed ${C.BLUE};line-height:0;font-size:0;">&nbsp;</div>`;
}

export function campsSpacer(size: "sm" | "md" | "lg" | "xl" = "md"): string {
  const h = { sm: 8, md: 16, lg: 28, xl: 44 }[size];
  return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
}

export function campsImage(url: string, alt: string, caption?: string | null): string {
  return `<p style="margin:0 0 16px;"><img src="${campsEsc(url)}" alt="${campsEsc(alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:2px solid ${C.BLUE};" />${
    caption
      ? `<span style="display:block;margin-top:6px;font-family:${F.BODY};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.BLUE};">${campsEsc(caption)}</span>`
      : ""
  }</p>`;
}

// ── Chrome ──────────────────────────────────────────────────
// The outer wrapper. Caller renders bodyHtml (eyebrow/heading/body/
// blocks/etc) and gets back a full <!doctype html> document.
//
// Layout: ink surround → blue ticker → blue masthead → cream body
// → blue footer. The body slot is generic so transactional copy,
// workflow blocks, or ticket stubs all use the same chrome.

export interface CampsChromeOptions {
  /** Browser-tab title. Defaults to "FFSA CAMPS". */
  title?: string;
  /** Hidden inbox-preview text (Gmail/iOS). */
  previewText?: string;
  /** Pre-rendered inner HTML for the cream-paper body slot. */
  bodyHtml: string;
  /** Used to build absolute URLs for any assets. */
  siteUrl?: string | null;
}

// FFSA CAMPS typographic lockup — heavy italic wordmark (no logo image,
// same approach as THE SEND's text lockup). `size` scales the masthead
// vs footer instances.
function campsLockup(size: number, color: string): string {
  return `<span style="${DISPLAY_STYLE}font-size:${size}px;color:${color};letter-spacing:-0.01em;text-transform:uppercase;line-height:1;">FFSA&nbsp;CAMPS</span>`;
}

export function campsChrome(opts: CampsChromeOptions): string {
  siteBase(opts.siteUrl); // reserved for future absolute-asset URLs
  const title = opts.title ?? "FFSA CAMPS";
  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.INK};">${campsEsc(opts.previewText)}</div>`
    : "";

  // Ticker repeats the slogan; sized to fit the 600px table.
  const ticker = `${CAMPS_SLOGAN}&nbsp;&nbsp;&#10022;&nbsp;&nbsp;${CAMPS_SLOGAN}&nbsp;&nbsp;&#10022;`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${campsEsc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.INK};font-family:${F.BODY};color:${C.INK};">
  ${preview}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.INK};padding:30px 10px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:${C.CREAM};table-layout:fixed;">

        <!-- Blue ticker bar -->
        <tr>
          <td style="background:${C.BLUE};border-bottom:2px solid ${C.CREAM};padding:8px 14px;${DISPLAY_STYLE}font-size:13px;color:${C.CREAM};letter-spacing:0.16em;text-transform:uppercase;line-height:1.2;overflow:hidden;white-space:nowrap;text-align:center;">
            ${ticker}
          </td>
        </tr>

        <!-- Blue masthead -->
        <tr>
          <td style="background:${C.BLUE};padding:16px 22px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td valign="middle">${campsLockup(22, C.CREAM)}</td>
                <td valign="middle" align="right" style="font-family:${F.BODY};font-size:10px;font-weight:700;color:${C.CREAM};letter-spacing:0.18em;text-transform:uppercase;">
                  SOUTH&nbsp;AFRICA / MMXXVI
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Cream body — caller-supplied content -->
        <tr>
          <td style="background:${C.CREAM};color:${C.INK};padding:34px 28px 28px 28px;">
            ${opts.bodyHtml}
          </td>
        </tr>

        <!-- Blue footer -->
        <tr>
          <td style="background:${C.BLUE};color:${C.CREAM};padding:26px 28px;text-align:center;">
            <p style="margin:0;">${campsLockup(24, C.CREAM)}</p>
            <p style="margin:14px 0 0;font-family:${F.BODY};font-size:12px;font-style:italic;line-height:1.6;color:${C.CREAM};opacity:0.92;max-width:420px;margin-left:auto;margin-right:auto;">
              ${campsEsc(CAMPS_VISION)}
            </p>
            <p style="margin:14px 0 0;font-family:${F.BODY};font-size:10px;font-weight:700;color:${C.CREAM};letter-spacing:0.2em;text-transform:uppercase;opacity:0.85;">
              Powered by FFSA Hub &middot; &copy;&nbsp;MMXXVI
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
// can swap between renderEmailShell / theSendEmailShell / campsEmailShell
// without changing per-template glue code.

export function campsEmailShell(opts: EmailShellOptions): string {
  const eyebrow = opts.eyebrow ? campsEyebrow(opts.eyebrow) : "";
  // Heading from EmailShellOptions may contain literal "<br/>" — keep it.
  const heading = campsHeading(opts.heading, { raw: true });
  const ctaHtml = opts.cta ? campsButton(opts.cta.url, opts.cta.label, "filled") : "";

  const bodyHtml = `${eyebrow}${heading}${opts.bodyHtml}${ctaHtml}`;

  return campsChrome({
    title: opts.title ?? opts.eyebrow,
    previewText: opts.preheader ?? opts.eyebrow,
    bodyHtml,
    siteUrl: opts.siteUrl,
  });
}
