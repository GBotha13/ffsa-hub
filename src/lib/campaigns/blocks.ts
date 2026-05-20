// ============================================================
// Campaign body — a list of simple blocks, stored in
// campaigns.body_source (jsonb) and rendered to email HTML
// (campaigns.body_html) at save time.
// ============================================================

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
      { id: newBlockId(), type: "heading", text: "Hello!" },
      {
        id: newBlockId(),
        type: "text",
        text: "Write your message here.",
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
 * Render the block list to email-safe HTML — table-based, inline styles,
 * 600px centered single column. `footerHtml` (unsubscribe links etc.) is
 * appended by the send worker.
 */
export function renderCampaignHtml(
  body: CampaignBody,
  opts: { accentColor?: string; previewText?: string; footerHtml?: string }
): string {
  const accent = opts.accentColor || "#1d4ed8";
  const rows = body.blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return `<tr><td style="padding:8px 0 4px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;">${escapeHtml(
            block.text
          )}</td></tr>`;
        case "text":
          return `<tr><td style="padding:8px 0;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(
            block.text
          ).replace(/\n/g, "<br/>")}</td></tr>`;
        case "button":
          return `<tr><td style="padding:14px 0;"><a href="${safeUrl(
            block.url
          )}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 26px;border-radius:8px;">${escapeHtml(
            block.text
          )}</a></td></tr>`;
        case "image":
          return `<tr><td style="padding:10px 0;"><img src="${safeUrl(
            block.url
          )}" alt="${escapeHtml(
            block.alt || ""
          )}" style="display:block;max-width:100%;height:auto;border:0;"/></td></tr>`;
        case "divider":
          return `<tr><td style="padding:14px 0;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>`;
        default:
          return "";
      }
    })
    .join("");

  const preview = opts.previewText
    ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(
        opts.previewText
      )}</div>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;">
<tr><td style="height:5px;background:${accent};border-radius:12px 12px 0 0;"></td></tr>
<tr><td style="padding:28px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr>
</table>
${opts.footerHtml ?? ""}
</td></tr>
</table>
</body></html>`;
}
