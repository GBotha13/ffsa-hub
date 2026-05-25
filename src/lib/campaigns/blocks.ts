// ============================================================
// Campaign body — a list of simple blocks, stored in
// campaigns.body_source (jsonb) and rendered to email HTML
// (campaigns.body_html) at save time.
//
// The renderer produces email-safe HTML in a bold, editorial
// style: serif display headings, generous spacing, branded
// header band + footer pulled from the sending identity's
// brand kit (src/services/brand.ts).
// ============================================================

import sanitizeHtml from "sanitize-html";
import {
  BRAND_DEFAULTS,
  mergeBrand,
  type EffectiveBrand,
  type SocialLink,
  type BrandKitRow,
} from "@/services/brand";

export type CampaignBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "button"; text: string; url: string }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "divider" };

export type CampaignBlockType = CampaignBlock["type"];

export type CampaignBody = {
  version: 1;
  blocks: CampaignBlock[];
};

let counter = 0;
export function newBlockId(): string {
  counter += 1;
  return `b_${Date.now().toString(36)}_${counter}`;
}

export function emptyCampaignBody(): CampaignBody {
  return {
    version: 1,
    blocks: [
      { id: newBlockId(), type: "heading", text: "A bold headline goes here" },
      {
        id: newBlockId(),
        type: "text",
        text: "Open with a sentence that sets the scene. Editorial emails earn the reader's attention by leading with substance, not pleasantries.",
      },
    ],
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Only allow http(s) URLs in links/images.
function safeUrl(u: string): string {
  const t = (u || "").trim();
  return /^https?:\/\//i.test(t) ? t : "#";
}

/**
 * Sanitize rich text from the Tiptap editor. Whitelists only the inline
 * emphasis tags + line/paragraph structure the editor can produce; strips
 * anything else (images, lists, scripts, styles). Links are kept only if
 * they target an http(s) URL.
 *
 * For legacy plain-text drafts (no tags at all), returns escaped text
 * with newlines converted to <br/> so existing campaigns keep rendering.
 */
function sanitizeRichText(input: string): string {
  const value = (input ?? "").toString();
  if (!value) return "";
  // Plain text path — preserves drafts written before rich text shipped.
  if (!/<[a-z][\s\S]*>/i.test(value)) {
    return escapeHtml(value).replace(/\n/g, "<br/>");
  }
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "a"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
  });
}

// ────────────────────────────────────────────────────────────
// Brand-aware fragments
// ────────────────────────────────────────────────────────────

function googleFontHref(brand: EffectiveBrand): string {
  // Curated set we serve via Google Fonts. Falls back gracefully in
  // clients that strip <link> (Outlook desktop) — the CSS font stacks
  // below include a generic serif/sans fallback.
  const fonts = new Set<string>();
  if (brand.display_font) fonts.add(brand.display_font);
  if (brand.body_font) fonts.add(brand.body_font);
  if (fonts.size === 0) return "";
  const families = Array.from(fonts)
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function displayStack(brand: EffectiveBrand): string {
  return `'${brand.display_font}', Georgia, 'Times New Roman', serif`;
}
function bodyStack(brand: EffectiveBrand): string {
  return `'${brand.body_font}', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif`;
}

function headerHtml(brand: EffectiveBrand): string {
  const band = `<tr><td style="height:6px;background:${brand.primary_color};border-radius:14px 14px 0 0;"></td></tr>`;
  if (!brand.logo_url) return band;
  return `${band}<tr><td style="padding:28px 36px 8px;text-align:center;">
<img src="${safeUrl(brand.logo_url)}" alt="${escapeHtml(brand.org_name)}" style="display:inline-block;max-height:56px;max-width:240px;height:auto;border:0;"/>
</td></tr>`;
}

const SOCIAL_LABELS: Record<SocialLink["platform"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
  web: "Website",
};

function brandFooterHtml(brand: EffectiveBrand): string {
  const socials = brand.social_links
    .filter((s) => /^https?:\/\//i.test(s.url))
    .map(
      (s) =>
        `<a href="${safeUrl(s.url)}" style="color:${brand.primary_color};text-decoration:none;font-weight:600;margin:0 8px;">${escapeHtml(SOCIAL_LABELS[s.platform] ?? s.platform)}</a>`
    )
    .join("");

  const tagline = brand.footer_tagline
    ? `<div style="font-style:italic;color:${brand.text_color};opacity:0.7;margin-bottom:14px;font-family:${displayStack(brand)};font-size:14px;">${escapeHtml(brand.footer_tagline)}</div>`
    : "";

  const socialRow = socials
    ? `<div style="margin-bottom:10px;">${socials}</div>`
    : "";

  const address = brand.org_address
    ? `<div style="opacity:0.75;">${escapeHtml(brand.org_address).replace(/\n/g, "<br/>")}</div>`
    : "";

  return `<tr><td style="padding:24px 36px 32px;border-top:1px solid #e2e8f0;text-align:center;font-family:${bodyStack(brand)};font-size:12px;line-height:1.6;color:${brand.text_color};">
${tagline}
<div style="font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:11px;color:${brand.primary_color};margin-bottom:8px;">${escapeHtml(brand.org_name)}</div>
${socialRow}
${address}
</td></tr>`;
}

// ────────────────────────────────────────────────────────────
// Block renderers
// ────────────────────────────────────────────────────────────

function renderBlock(block: CampaignBlock, brand: EffectiveBrand): string {
  switch (block.type) {
    case "heading":
      return `<tr><td style="padding:18px 0 8px;font-family:${displayStack(brand)};font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;color:${brand.primary_color};">${escapeHtml(block.text)}</td></tr>`;
    case "text": {
      // Wrap sanitized rich-text in a styled container. Tiptap emits <p>
      // tags, so we strip default <p> margins via a child selector below
      // (inlined since email clients ignore <style>).
      const safe = sanitizeRichText(block.text)
        // Inject inline styles into <p> + <a> so the typography matches
        // the brand kit even in clients that strip <style>.
        .replace(
          /<p(\s|>)/g,
          `<p style="margin:0 0 12px;font-family:${bodyStack(brand)};font-size:16px;line-height:1.7;color:${brand.text_color};"$1`
        )
        .replace(
          /<a(\s|>)/g,
          `<a style="color:${brand.accent_color};text-decoration:underline;"$1`
        );
      return `<tr><td style="padding:6px 0;font-family:${bodyStack(brand)};font-size:16px;line-height:1.7;color:${brand.text_color};">${safe}</td></tr>`;
    }
    case "button":
      return `<tr><td style="padding:20px 0;">
<a href="${safeUrl(block.url)}" style="display:inline-block;background:${brand.accent_color};color:#ffffff;text-decoration:none;font-family:${bodyStack(brand)};font-size:15px;font-weight:600;letter-spacing:0.01em;padding:14px 30px;border-radius:6px;">${escapeHtml(block.text)}</a>
</td></tr>`;
    case "image":
      return `<tr><td style="padding:14px 0;">
<img src="${safeUrl(block.url)}" alt="${escapeHtml(block.alt || "")}" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:4px;"/>
</td></tr>`;
    case "divider":
      return `<tr><td style="padding:20px 0;">
<div style="border-top:2px solid ${brand.primary_color};width:48px;"></div>
</td></tr>`;
    default:
      return "";
  }
}

// ────────────────────────────────────────────────────────────
// Top-level render
// ────────────────────────────────────────────────────────────

export type RenderOpts = {
  previewText?: string;
  /** Per-recipient compliance footer (unsubscribe link). Appended after the brand footer. */
  footerHtml?: string;
  /** Brand kit — pass the effective brand from getEffectiveBrand(). Falls back to editorial defaults. */
  brand?: EffectiveBrand | BrandKitRow | null;
};

/**
 * Render the block list to email-safe HTML — table-based, inline styles,
 * 640px centered single column with an editorial brand header + footer.
 * The send worker appends a per-recipient compliance footer via `footerHtml`.
 */
export function renderCampaignHtml(
  body: CampaignBody,
  opts: RenderOpts = {}
): string {
  const brand: EffectiveBrand =
    opts.brand && "primary_color" in opts.brand && typeof opts.brand.primary_color === "string"
      ? (opts.brand as EffectiveBrand)
      : mergeBrand((opts.brand as BrandKitRow) ?? null);

  const fontHref = googleFontHref(brand);
  const rows = body.blocks.map((b) => renderBlock(b, brand)).join("");

  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">${escapeHtml(opts.previewText)}</div>`
    : "";

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
${fontHref ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${fontHref}" rel="stylesheet">` : ""}
<title>${escapeHtml(brand.org_name)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.bg_color};font-family:${bodyStack(brand)};">
${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg_color};padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
${headerHtml(brand)}
<tr><td style="padding:24px 44px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr>
${brandFooterHtml(brand)}
</table>
${opts.footerHtml ?? ""}
</td></tr>
</table>
</body></html>`;
}

// Re-export editorial defaults so the UI can show "this is what an empty brand
// kit looks like" without importing from the service directly.
export { BRAND_DEFAULTS } from "@/services/brand";
