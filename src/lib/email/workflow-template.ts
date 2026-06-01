// ============================================================
// Fire & Fragrance workflow-email template
// ============================================================
// A fixed, branded shell every workflow step email renders inside —
// the block editor only supplies the copy.
//
// IMPORTANT: this is the *Fire & Fragrance* brand (the hub's parent),
// NOT "The Send". The two are distinct identities and must never be
// designed using each other. F&F = Roboto / Roboto Mono, black + gold
// + white, black pill buttons (source: fireandfragrance.com). The
// Send's navy/red/blue ticket aesthetic lives only in its own template.
//
// Email-safe: inline CSS, single 600px table. Roboto / Roboto Mono are
// loaded via Google Fonts for clients that support webfonts (Apple Mail,
// iOS); everything falls back to Arial / Courier elsewhere.
// ============================================================

import sanitizeHtml from "sanitize-html";
import type { CampaignBody, CampaignBlock } from "@/lib/campaigns/blocks";

const BLACK = "#141414"; // masthead / footer
const INK = "#1A1A1A"; // headings + body text
const GOLD = "#F5C84B"; // the F&F accent
const PAPER = "#FBFAF7"; // warm near-white body
const MUTED = "#6E6E6E";
const WHITE = "#FFFFFF";

const SANS = "'Roboto',Arial,Helvetica,sans-serif";
const MONO = "'Roboto Mono','Courier New',Courier,monospace";

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700&family=Roboto+Mono:wght@400;500;700&display=swap" rel="stylesheet" />';

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function richText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "a", "span", "ul", "ol", "li"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    transformTags: {
      a: (_t, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          style: `color:${INK};text-decoration:underline;text-decoration-color:${GOLD};`,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      p: () => ({
        tagName: "p",
        attribs: {
          style: `margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};`,
        },
      }),
    },
  });
}

function eyebrow(text: string): string {
  return `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:${INK};"><span style="color:${GOLD};">&bull;</span>&nbsp;&nbsp;${esc(text)}</p>`;
}

function renderBlock(b: CampaignBlock): string {
  switch (b.type) {
    case "eyebrow":
      return eyebrow(b.text);

    case "heading":
      return `${b.eyebrow ? eyebrow(b.eyebrow) : ""}<h1 style="margin:0 0 14px;font-family:${SANS};font-size:27px;line-height:1.1;font-weight:900;letter-spacing:-0.01em;text-transform:uppercase;color:${INK};">${esc(b.text)}</h1>`;

    case "text":
      return `<div style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};">${richText(b.text)}</div>`;

    case "button": {
      const style = b.style ?? "filled";
      if (style === "link") {
        return `<p style="margin:6px 0 18px;"><a href="${esc(b.url)}" style="font-family:${SANS};font-size:15px;font-weight:700;color:${INK};text-decoration:underline;text-decoration-color:${GOLD};">${esc(b.text)} &rarr;</a></p>`;
      }
      const outline = style === "outline";
      const bg = outline ? PAPER : BLACK;
      const fg = outline ? INK : WHITE;
      const border = outline ? `2px solid ${INK}` : `2px solid ${BLACK}`;
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-radius:999px;background:${bg};border:${border};">
<a href="${esc(b.url)}" style="display:inline-block;padding:13px 30px;font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${fg};text-decoration:none;">${esc(b.text)}</a>
</td></tr></table>`;
    }

    case "image":
      return `<p style="margin:0 0 16px;"><img src="${esc(b.url)}" alt="${esc(b.alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;" />${
        b.caption
          ? `<span style="display:block;margin-top:6px;font-family:${MONO};font-size:11px;color:${MUTED};">${esc(b.caption)}</span>`
          : ""
      }</p>`;

    case "quote":
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;"><tr>
<td style="border-left:4px solid ${GOLD};padding:4px 0 4px 18px;font-family:${SANS};font-size:18px;line-height:1.5;font-style:italic;color:${INK};">${esc(b.text)}${
        b.attribution
          ? `<span style="display:block;margin-top:8px;font-family:${MONO};font-size:11px;font-style:normal;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">&mdash; ${esc(b.attribution)}</span>`
          : ""
      }</td></tr></table>`;

    case "divider": {
      const s = b.style ?? "rule";
      if (s === "space") return `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>`;
      if (s === "dots")
        return `<p style="margin:14px 0;text-align:center;font-family:${MONO};font-size:16px;letter-spacing:0.4em;color:${GOLD};">&middot;&nbsp;&middot;&nbsp;&middot;</p>`;
      return `<div style="margin:20px 0;border-top:1px solid ${INK};opacity:0.14;line-height:0;font-size:0;">&nbsp;</div>`;
    }

    case "spacer": {
      const h = { sm: 8, md: 16, lg: 28, xl: 44 }[b.size ?? "md"];
      return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
    }

    case "image-text":
      return `<p style="margin:0 0 12px;"><img src="${esc(b.url)}" alt="${esc(b.alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;" /></p>${
        b.heading
          ? `<h2 style="margin:0 0 8px;font-family:${SANS};font-size:20px;line-height:1.15;font-weight:900;text-transform:uppercase;color:${INK};">${esc(b.heading)}</h2>`
          : ""
      }<div style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};">${richText(b.text)}</div>`;

    default:
      return "";
  }
}

export type WorkflowEmailOpts = {
  baseUrl: string; // e.g. https://www.ffsahub.com — for the logo assets
  prefsUrl: string; // manage-preferences / unsubscribe link
  previewText?: string;
};

export function renderWorkflowEmail(
  body: CampaignBody | null | undefined,
  opts: WorkflowEmailOpts
): string {
  const base = opts.baseUrl.replace(/\/$/, "");
  const blocks = (body?.blocks ?? []).map(renderBlock).join("");

  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${PAPER};">${esc(opts.previewText)}</div>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />${FONT_LINK}</head>
<body style="margin:0;padding:0;background:${BLACK};font-family:${SANS};color:${INK};">
${preview}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BLACK};padding:28px 10px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:${PAPER};table-layout:fixed;">

  <!-- Masthead -->
  <tr><td style="background:${BLACK};padding:18px 28px;border-bottom:2px solid ${GOLD};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td valign="middle">
        <img src="${base}/brand/ff-wordmark-white@email.png" alt="Fire &amp; Fragrance" width="148" height="auto" style="display:block;width:148px;height:auto;" />
      </td>
      <td valign="middle" align="right" style="font-family:${MONO};font-size:10px;color:${GOLD};letter-spacing:0.2em;text-transform:uppercase;">South&nbsp;Africa</td>
    </tr></table>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:${PAPER};padding:36px 30px 14px 30px;">
    ${blocks || `<p style="font-family:${SANS};font-size:15px;color:${INK};">&nbsp;</p>`}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${BLACK};padding:28px 30px;text-align:center;">
    <img src="${base}/brand/ff-wordmark-white@email.png" alt="Fire &amp; Fragrance" width="124" height="auto" style="display:inline-block;width:124px;height:auto;" />
    <p style="margin:12px 0 0;font-family:${MONO};font-size:10px;color:${GOLD};letter-spacing:0.2em;text-transform:uppercase;">Fire &amp; Fragrance South Africa</p>
    <p style="margin:10px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${WHITE};opacity:0.78;">
      <a href="${esc(opts.prefsUrl)}" style="color:${WHITE};text-decoration:underline;">Manage email preferences</a>
    </p>
    <p style="margin:8px 0 0;font-family:${MONO};font-size:9px;color:${WHITE};letter-spacing:0.16em;text-transform:uppercase;opacity:0.5;">Powered by FFSA Hub</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}
