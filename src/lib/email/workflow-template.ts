// ============================================================
// Fire & Fragrance workflow-email template
// ============================================================
// A fixed, branded shell that every workflow step email renders
// inside — the block editor only supplies the content. Design is
// based on fireandfragrance.com + the bespoke "The Send" email:
// navy masthead with the F&F wordmark + gold rule, cream "paper"
// body, navy footer with the wordmark + manage-preferences link.
//
// Email-safe: inline CSS only, single 600px table, system fonts
// (Arial Black display, Helvetica body, Courier mono) — the web
// fonts (Anton/condensed grotesque) don't load in mail clients,
// so Arial Black is the closest universally-available stand-in.
// ============================================================

import sanitizeHtml from "sanitize-html";
import type { CampaignBody, CampaignBlock } from "@/lib/campaigns/blocks";

const GOLD = "#FACF50";
const CREAM = "#F7F1E8";
const RED = "#FA0015";
const BLUE = "#1535C6";
const NAVY = "#1C314C";
const INK = "#0E1A2B";

const DISPLAY = "'Arial Black','Helvetica Neue',Arial,sans-serif";
const BODY = "Helvetica,Arial,sans-serif";
const MONO = "'Courier New',Courier,monospace";

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Rich text from the composer — restrict to the marks the editor can
// produce, and force inline styles email clients keep.
function richText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "a", "span", "ul", "ol", "li"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    transformTags: {
      a: (_t, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          style: `color:${BLUE};text-decoration:underline;`,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      p: () => ({
        tagName: "p",
        attribs: {
          style: `margin:0 0 14px;font-family:${BODY};font-size:15px;line-height:1.65;color:${INK};`,
        },
      }),
    },
  });
}

function renderBlock(b: CampaignBlock): string {
  switch (b.type) {
    case "eyebrow":
      return `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${BLUE};">&bull;&nbsp;${esc(b.text)}</p>`;

    case "heading":
      return `${
        b.eyebrow
          ? `<p style="margin:0 0 8px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${BLUE};">&bull;&nbsp;${esc(b.eyebrow)}</p>`
          : ""
      }<h1 style="margin:0 0 14px;font-family:${DISPLAY};font-size:28px;line-height:1.08;font-weight:900;letter-spacing:0.005em;text-transform:uppercase;color:${NAVY};">${esc(b.text)}</h1>`;

    case "text":
      return `<div style="margin:0 0 16px;font-family:${BODY};font-size:15px;line-height:1.65;color:${INK};">${richText(b.text)}</div>`;

    case "button": {
      const style = b.style ?? "filled";
      if (style === "link") {
        return `<p style="margin:6px 0 18px;"><a href="${esc(b.url)}" style="font-family:${BODY};font-size:15px;font-weight:700;color:${BLUE};text-decoration:underline;">${esc(b.text)} &rarr;</a></p>`;
      }
      const bg = style === "outline" ? CREAM : RED;
      const fg = style === "outline" ? NAVY : CREAM;
      const border = style === "outline" ? `2px solid ${NAVY}` : `2px solid ${RED}`;
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr><td style="border-radius:4px;background:${bg};border:${border};">
<a href="${esc(b.url)}" style="display:inline-block;padding:12px 26px;font-family:${DISPLAY};font-size:14px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${fg};text-decoration:none;">${esc(b.text)}</a>
</td></tr></table>`;
    }

    case "image":
      return `<p style="margin:0 0 16px;"><img src="${esc(b.url)}" alt="${esc(b.alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;" />${
        b.caption
          ? `<span style="display:block;margin-top:6px;font-family:${MONO};font-size:11px;color:${NAVY};opacity:0.7;">${esc(b.caption)}</span>`
          : ""
      }</p>`;

    case "quote":
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;"><tr>
<td style="border-left:4px solid ${GOLD};padding:4px 0 4px 16px;font-family:${BODY};font-size:17px;line-height:1.5;font-style:italic;color:${NAVY};">${esc(b.text)}${
        b.attribution
          ? `<span style="display:block;margin-top:8px;font-family:${MONO};font-size:11px;font-style:normal;letter-spacing:0.1em;text-transform:uppercase;color:${NAVY};opacity:0.7;">&mdash; ${esc(b.attribution)}</span>`
          : ""
      }</td></tr></table>`;

    case "divider": {
      const s = b.style ?? "rule";
      if (s === "space") return `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>`;
      if (s === "dots")
        return `<p style="margin:14px 0;text-align:center;font-family:${MONO};font-size:16px;letter-spacing:0.4em;color:${GOLD};">&middot;&nbsp;&middot;&nbsp;&middot;</p>`;
      return `<div style="margin:18px 0;border-top:2px solid ${NAVY};opacity:0.18;line-height:0;font-size:0;">&nbsp;</div>`;
    }

    case "spacer": {
      const h = { sm: 8, md: 16, lg: 28, xl: 44 }[b.size ?? "md"];
      return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
    }

    case "image-text":
      // Email-safe: stack the image above the text.
      return `<p style="margin:0 0 12px;"><img src="${esc(b.url)}" alt="${esc(b.alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;" /></p>${
        b.heading
          ? `<h2 style="margin:0 0 8px;font-family:${DISPLAY};font-size:20px;line-height:1.1;font-weight:900;text-transform:uppercase;color:${NAVY};">${esc(b.heading)}</h2>`
          : ""
      }<div style="margin:0 0 16px;font-family:${BODY};font-size:15px;line-height:1.65;color:${INK};">${richText(b.text)}</div>`;

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
  const year = "MMXXVI"; // editorial year stamp (Date.now is unavailable in some contexts)

  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${INK};">${esc(opts.previewText)}</div>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${INK};font-family:${BODY};color:${INK};">
${preview}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${INK};padding:28px 10px;">
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:${CREAM};table-layout:fixed;">

  <!-- Masthead -->
  <tr><td style="background:${NAVY};padding:18px 28px;border-bottom:3px solid ${GOLD};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td valign="middle">
        <img src="${base}/brand/ff-wordmark-white@email.png" alt="Fire &amp; Fragrance" width="150" height="auto" style="display:block;width:150px;height:auto;" />
      </td>
      <td valign="middle" align="right" style="font-family:${MONO};font-size:10px;color:${GOLD};letter-spacing:0.2em;text-transform:uppercase;">South&nbsp;Africa</td>
    </tr></table>
  </td></tr>

  <!-- Body / paper -->
  <tr><td style="background:${CREAM};padding:34px 28px 12px 28px;">
    ${blocks || `<p style="font-family:${BODY};font-size:15px;color:${INK};">&nbsp;</p>`}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${NAVY};padding:26px 28px;text-align:center;">
    <img src="${base}/brand/ff-wordmark-white@email.png" alt="Fire &amp; Fragrance" width="130" height="auto" style="display:inline-block;width:130px;height:auto;opacity:0.9;" />
    <p style="margin:12px 0 0;font-family:${MONO};font-size:10px;color:${GOLD};letter-spacing:0.2em;text-transform:uppercase;">Fire &amp; Fragrance South Africa</p>
    <p style="margin:10px 0 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${CREAM};opacity:0.8;">
      <a href="${esc(opts.prefsUrl)}" style="color:${CREAM};text-decoration:underline;">Manage email preferences</a>
    </p>
    <p style="margin:8px 0 0;font-family:${MONO};font-size:9px;color:${CREAM};letter-spacing:0.18em;text-transform:uppercase;opacity:0.55;">&copy;&nbsp;${year} &middot; Powered by FFSA Hub</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}
