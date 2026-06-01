import Image from "next/image";
import type { CSSProperties } from "react";

// Shared visual shell for all public-facing form/landing pages.
// Mirrors the renderEmailShell layout so emails and the linked pages
// feel like one continuous brand surface.
//
// Tokens are deliberately fixed (not Tailwind-driven) so the shell stays
// stable even if global theme variables change.

export const PUBLIC_SHELL_TOKENS = {
  bg: "#0D0B09",
  card: "#141210",
  cardElev: "hsl(22 10% 9%)",
  border: "#2a2420",
  borderSoft: "hsl(22 8% 18%)",
  text: "#F0EBE3",
  textDim: "#B8A898",
  textDimmer: "#7a6e64",
  textFaint: "#3a3028",
  yellow: "#F5C518",
  yellowHover: "#fdd34c",
  green: "hsl(142 60% 55%)",
  red: "hsl(0 75% 65%)",
} as const;

const T = PUBLIC_SHELL_TOKENS;

export function PublicFormShell({
  eyebrow,
  heading,
  subheading,
  children,
  maxWidth = 560,
  footerNote,
  tagline = "CATALYSE A GENERATION · EVANGELISE THE WORLD",
}: {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  children: React.ReactNode;
  maxWidth?: number;
  footerNote?: string | null;
  /** Override or hide the bottom tagline strip. Pass null to remove. */
  tagline?: string | null;
}) {
  return (
    <div
      className="min-h-screen px-4 py-10 sm:py-12"
      style={{ background: T.bg, color: T.text, colorScheme: "dark" }}
    >
      <div className="mx-auto" style={{ maxWidth }}>
        <BrandLockup />

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.4), 0 24px 40px -24px rgba(0,0,0,0.6)",
          }}
        >
          {/* Top accent rail */}
          <div
            style={{
              height: 3,
              background: `linear-gradient(90deg, transparent, ${T.yellow}, transparent)`,
            }}
          />

          <div className="px-6 sm:px-9 py-9">
            {(eyebrow || heading || subheading) && (
              <div className="mb-7">
                {eyebrow && (
                  <p
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.25em",
                      fontWeight: 700,
                      color: T.yellow,
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    {eyebrow}
                  </p>
                )}
                {heading && (
                  <h1
                    style={{
                      fontFamily:
                        "var(--font-bebas, 'Arial Black', sans-serif)",
                      fontSize: "2.25rem",
                      lineHeight: 1.05,
                      letterSpacing: "0.03em",
                      color: T.text,
                      margin: eyebrow ? "8px 0 0" : 0,
                    }}
                  >
                    {heading}
                  </h1>
                )}
                {subheading && (
                  <p
                    style={{
                      fontSize: 15,
                      color: T.textDim,
                      lineHeight: 1.6,
                      margin: "12px 0 0",
                    }}
                  >
                    {subheading}
                  </p>
                )}
              </div>
            )}

            {children}
          </div>
        </div>

        <Footer footerNote={footerNote} tagline={tagline} />
      </div>
    </div>
  );
}

function BrandLockup() {
  return (
    <div className="flex flex-col items-center mb-6">
      <Image
        src="/brand/ff-wordmark-white.png"
        alt="Fire & Fragrance"
        width={220}
        height={26}
        priority
        style={{
          objectFit: "contain",
          maxWidth: "60%",
          height: "auto",
          width: "auto",
        }}
      />
      <div
        className="flex items-center gap-2 mt-3"
        style={{ color: T.yellow }}
      >
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 1,
            background: T.yellow,
          }}
        />
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.32em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          South Africa &middot; Hub
        </span>
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 1,
            background: T.yellow,
          }}
        />
      </div>
    </div>
  );
}

function Footer({
  footerNote,
  tagline,
}: {
  footerNote?: string | null;
  tagline: string | null;
}) {
  return (
    <div className="text-center mt-6 mb-2 space-y-2">
      {footerNote && (
        <p style={{ fontSize: 12, color: T.textDimmer, margin: 0 }}>
          {footerNote}
        </p>
      )}
      {tagline && (
        <p
          style={{
            fontSize: 10,
            letterSpacing: "0.25em",
            fontWeight: 700,
            color: T.textFaint,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {tagline}
        </p>
      )}
      <p style={{ fontSize: 11, color: T.textFaint, margin: 0 }}>
        Fire &amp; Fragrance South Africa &mdash;{" "}
        <a
          href="https://www.ffsahub.com"
          style={{ color: T.textFaint, textDecoration: "none" }}
        >
          ffsahub.com
        </a>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Notice variant — used for invalid-link / closed / expired pages
// ─────────────────────────────────────────────────────────────────

export function PublicFormNotice({
  eyebrow,
  heading,
  body,
}: {
  eyebrow?: string;
  heading: string;
  body: string;
}) {
  return (
    <PublicFormShell eyebrow={eyebrow} heading={heading} maxWidth={480}>
      <p
        style={{
          fontSize: 15,
          color: T.textDim,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {body}
      </p>
    </PublicFormShell>
  );
}

// ─────────────────────────────────────────────────────────────────
// Input primitives — dark-themed building blocks for form bodies
// ─────────────────────────────────────────────────────────────────

const inputBaseStyle: CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: `1px solid ${T.borderSoft}`,
  background: T.cardElev,
  color: T.text,
  fontSize: 15,
  outline: "none",
  transition: "border-color .15s ease, box-shadow .15s ease",
  WebkitAppearance: "none",
  MozAppearance: "none",
  appearance: "none",
};

export const PUBLIC_INPUT_STYLE = inputBaseStyle;

/** Inline <style> block placed once per page that applies the dark input
 * styling to all native inputs/selects/textareas inside `.ffsa-public`. */
export function PublicFormInputStyles() {
  const css = `
.ffsa-public input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]),
.ffsa-public textarea,
.ffsa-public select {
  width: 100%;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid ${T.borderSoft};
  background: ${T.cardElev};
  color: ${T.text};
  font-size: 15px;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
.ffsa-public select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%23B8A898' stroke-width='2'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 12px 8px;
  padding-right: 36px;
}
.ffsa-public input:focus, .ffsa-public textarea:focus, .ffsa-public select:focus {
  border-color: ${T.yellow};
  box-shadow: 0 0 0 3px ${T.yellow}33;
}
.ffsa-public input::placeholder, .ffsa-public textarea::placeholder {
  color: ${T.textDimmer};
}
.ffsa-public label {
  color: ${T.text};
}
.ffsa-public-btn-primary {
  background: ${T.yellow};
  color: ${T.bg};
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  padding: 14px 28px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: background .15s ease, transform .04s ease;
}
.ffsa-public-btn-primary:hover:not(:disabled) {
  background: ${T.yellowHover};
}
.ffsa-public-btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}
.ffsa-public-btn-primary:disabled {
  background: ${T.borderSoft};
  color: ${T.textDimmer};
  cursor: not-allowed;
}
.ffsa-public-btn-ghost {
  background: transparent;
  color: ${T.textDim};
  font-size: 13px;
  padding: 10px 14px;
  border: none;
  cursor: pointer;
  transition: color .15s ease;
}
.ffsa-public-btn-ghost:hover:not(:disabled) {
  color: ${T.text};
}
.ffsa-public-card {
  background: ${T.cardElev};
  border: 1px solid ${T.borderSoft};
  border-radius: 12px;
  padding: 14px 16px;
}
.ffsa-public-card.is-selected {
  border-color: ${T.yellow};
  background: ${T.yellow}14;
}
.ffsa-public-error {
  color: ${T.red};
  font-size: 13px;
  margin-top: 6px;
}
.ffsa-public-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: ${T.text};
  margin-bottom: 6px;
}
.ffsa-public-label-required::after {
  content: ' *';
  color: ${T.red};
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
