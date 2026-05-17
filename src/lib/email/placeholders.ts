// Tiny placeholder substitution used by per-program email overrides.
// We deliberately support only a small, stable set of tokens so admins
// can't reference arbitrary user data by accident.

export type AcceptancePlaceholders = {
  first_name: string;
  program_name: string;
};

export function substitutePlaceholders(
  template: string,
  values: AcceptancePlaceholders
): string {
  return template
    .replace(/\{\{\s*first_name\s*\}\}/g, values.first_name)
    .replace(/\{\{\s*program_name\s*\}\}/g, values.program_name);
}

// Escape user-entered plain text before splicing into HTML.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Convert a plain-text custom body into HTML paragraphs suitable for
// dropping into the FFSA email shell. Blank lines become paragraph
// breaks; single newlines become <br/>.
export function plainTextToEmailHtml(text: string): string {
  const escaped = escapeHtml(text.trim());
  if (!escaped) return "";
  const paragraphs = escaped.split(/\n{2,}/);
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;color:#B8A898;line-height:1.65;">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");
}
