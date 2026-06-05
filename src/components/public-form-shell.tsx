import Image from "next/image";
import type { CSSProperties } from "react";

// Shared visual shell for all public-facing form/landing pages.
// Mirrors the renderEmailShell layout so emails and the linked pages
// feel like one continuous brand surface.
//
// Tokens are deliberately fixed (not Tailwind-driven) so the shell stays
// stable even if global theme variables change.
//
// Brand model: pages that aren't event-tied (preferences, unsubscribe,
// applications, references, scheduling, legal) keep the default 'ff'
// brand. Event-tied surfaces (outcome forms, the storefront) pass the
// event's brand so workflow emails, the form page, and the storefront
// all read as one continuous identity.

export type PublicShellBrand = "ff" | "the_send";

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

// THE SEND token set — same shape as PUBLIC_SHELL_TOKENS so consumers
// can swap with a single `brand === 'the_send' ? SEND : PUBLIC` switch
// and use the same key names. Inside-card tokens (text, textDim) target
// the cream paper background; outside-card tokens (textDimmer, textFaint)
// target the dark navy page background.
export const THE_SEND_SHELL_TOKENS = {
  bg: "#0E1A2B",
  card: "#F7F1E8",
  cardElev: "#FFFFFF",
  border: "#1C314C",
  borderSoft: "rgba(28,49,76,0.18)",
  text: "#1C314C",
  textDim: "rgba(28,49,76,0.72)",
  textDimmer: "rgba(247,241,232,0.55)",
  textFaint: "rgba(247,241,232,0.3)",
  yellow: "#FACF50",
  yellowHover: "#FBDA82",
  green: "#FACF50",
  red: "#FA0015",
} as const;

export function tokensForBrand(brand: PublicShellBrand) {
  return brand === "the_send" ? THE_SEND_SHELL_TOKENS : PUBLIC_SHELL_TOKENS;
}

const T = PUBLIC_SHELL_TOKENS;

export function PublicFormShell({
  eyebrow,
  heading,
  subheading,
  children,
  maxWidth = 560,
  footerNote,
  tagline,
  brand = "ff",
}: {
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  children: React.ReactNode;
  maxWidth?: number;
  footerNote?: string | null;
  /** Override or hide the bottom tagline strip. Pass null to remove. */
  tagline?: string | null;
  /** Visual brand. Defaults to 'ff' so non-event-tied surfaces stay unchanged. */
  brand?: PublicShellBrand;
}) {
  const isTheSend = brand === "the_send";
  const tk = tokensForBrand(brand);
  // Brand-specific defaults so existing F&F callers keep their tagline
  // and SEND callers get the SEND ticker line out of the box.
  const resolvedTagline =
    tagline === undefined
      ? isTheSend
        ? "THE WAR ON INACTION HAS BEGUN"
        : "CATALYSE A GENERATION · EVANGELISE THE WORLD"
      : tagline;

  // SEND uses a flat cream card with a thick navy border and no shadow —
  // matches the bespoke storefront + the ticket email. F&F keeps the
  // rounded dark card with a soft shadow.
  const cardStyle: CSSProperties = isTheSend
    ? {
        background: tk.card,
        border: `3px solid ${tk.border}`,
        borderRadius: 0,
      }
    : {
        background: tk.card,
        border: `1px solid ${tk.border}`,
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.4), 0 24px 40px -24px rgba(0,0,0,0.6)",
      };

  // Heading font: F&F uses Bebas (web-loaded); SEND uses Arial Black
  // so it lines up exactly with the email + storefront masthead.
  const headingFontFamily = isTheSend
    ? "'Arial Black','Helvetica Neue',Arial,sans-serif"
    : "var(--font-bebas, 'Arial Black', sans-serif)";

  return (
    <div
      className="min-h-screen px-4 py-10 sm:py-12"
      style={{
        background: tk.bg,
        color: tk.text,
        // F&F's card is dark so we tell the browser to render native
        // form chrome in dark mode. SEND's card is cream paper, so we
        // explicitly opt into light chrome — otherwise Safari forces
        // dark fill/text on inputs that overrides our white background +
        // navy text styling.
        colorScheme: isTheSend ? "light" : "dark",
      }}
    >
      <div className="mx-auto" style={{ maxWidth }}>
        <BrandLockup brand={brand} />

        <div
          className={isTheSend ? "overflow-hidden" : "rounded-2xl overflow-hidden"}
          style={cardStyle}
        >
          {/* Top accent rail — F&F: soft gradient gold; SEND: solid gold
              ticker that mirrors the email header. */}
          {isTheSend ? (
            <div
              style={{
                background: tk.yellow,
                borderBottom: `3px solid ${tk.border}`,
                padding: "8px 14px",
                fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
                fontSize: 13,
                fontWeight: 900,
                color: tk.border,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span style={{ color: tk.red }}>→</span>
              &nbsp;THE WAR ON INACTION HAS BEGUN&nbsp;
              <span style={{ color: tk.red }}>→</span>
            </div>
          ) : (
            <div
              style={{
                height: 3,
                background: `linear-gradient(90deg, transparent, ${tk.yellow}, transparent)`,
              }}
            />
          )}

          <div className="px-6 sm:px-9 py-9">
            {(eyebrow || heading || subheading) && (
              <div className="mb-7">
                {eyebrow && (
                  <p
                    style={{
                      fontFamily: isTheSend
                        ? "'Courier New',Courier,monospace"
                        : undefined,
                      fontSize: 11,
                      letterSpacing: isTheSend ? "0.2em" : "0.25em",
                      fontWeight: 700,
                      color: isTheSend ? tk.textDimmer : tk.yellow,
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    {isTheSend ? `// ${eyebrow}` : eyebrow}
                  </p>
                )}
                {heading && (
                  <h1
                    style={{
                      fontFamily: headingFontFamily,
                      fontSize: "2.25rem",
                      lineHeight: 1.05,
                      letterSpacing: isTheSend ? "0.005em" : "0.03em",
                      textTransform: isTheSend ? "uppercase" : undefined,
                      color: tk.text,
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
                      color: tk.textDim,
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

        <Footer footerNote={footerNote} tagline={resolvedTagline} brand={brand} />
      </div>
    </div>
  );
}

function BrandLockup({ brand }: { brand: PublicShellBrand }) {
  if (brand === "the_send") {
    const tk = THE_SEND_SHELL_TOKENS;
    return (
      <div className="flex flex-col items-center mb-6">
        <p
          style={{
            margin: 0,
            fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
            fontSize: 28,
            fontWeight: 900,
            color: tk.yellow,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          THE&nbsp;SEND&nbsp;
          <span
            style={{
              fontFamily: "Helvetica,Arial,sans-serif",
              fontSize: 24,
              color: tk.yellow,
            }}
          >
            →
          </span>
        </p>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: "'Courier New',Courier,monospace",
            fontSize: 10,
            color: tk.textDimmer,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          SOUTH&nbsp;AFRICA / MMXXVI
        </p>
      </div>
    );
  }
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
  brand,
}: {
  footerNote?: string | null;
  tagline: string | null;
  brand: PublicShellBrand;
}) {
  const tk = tokensForBrand(brand);
  const isTheSend = brand === "the_send";
  return (
    <div className="text-center mt-6 mb-2 space-y-2">
      {footerNote && (
        <p
          style={{
            fontSize: 12,
            color: tk.textDimmer,
            margin: 0,
            fontFamily: isTheSend
              ? "'Courier New',Courier,monospace"
              : undefined,
            letterSpacing: isTheSend ? "0.14em" : undefined,
            textTransform: isTheSend ? "uppercase" : undefined,
          }}
        >
          {isTheSend ? `// ${footerNote}` : footerNote}
        </p>
      )}
      {tagline && (
        <p
          style={{
            fontFamily: isTheSend
              ? "'Arial Black','Helvetica Neue',Arial,sans-serif"
              : undefined,
            fontSize: isTheSend ? 11 : 10,
            letterSpacing: isTheSend ? "0.18em" : "0.25em",
            fontWeight: isTheSend ? 900 : 700,
            color: isTheSend ? tk.yellow : tk.textFaint,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {tagline}
        </p>
      )}
      <p
        style={{
          fontSize: 11,
          color: tk.textFaint,
          margin: 0,
          fontFamily: isTheSend
            ? "'Courier New',Courier,monospace"
            : undefined,
          letterSpacing: isTheSend ? "0.18em" : undefined,
          textTransform: isTheSend ? "uppercase" : undefined,
        }}
      >
        {isTheSend ? "Powered by FFSA Hub" : "Fire & Fragrance South Africa"}
        {" — "}
        <a
          href="https://www.ffsahub.com"
          style={{ color: tk.textFaint, textDecoration: "none" }}
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
  brand = "ff",
}: {
  eyebrow?: string;
  heading: string;
  body: string;
  brand?: PublicShellBrand;
}) {
  const tk = tokensForBrand(brand);
  return (
    <PublicFormShell
      eyebrow={eyebrow}
      heading={heading}
      maxWidth={480}
      brand={brand}
    >
      <p
        style={{
          fontSize: 15,
          color: tk.textDim,
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
 * styling to all native inputs/selects/textareas inside `.ffsa-public`.
 * Pass brand='the_send' for the navy/cream/gold variant — both versions
 * scope under the same `.ffsa-public` class so the caller's wrapper
 * doesn't have to change. */
export function PublicFormInputStyles({
  brand = "ff",
}: {
  brand?: PublicShellBrand;
}) {
  if (brand === "the_send") {
    const tk = THE_SEND_SHELL_TOKENS;
    // Note: chevron SVG colour is hard-coded to navy so it reads on the
    // white input background. URI-encoded directly.
    const chevronSvg =
      "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none' stroke='%231C314C' stroke-width='2'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E";
    const css = `
.ffsa-public input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]):not([type="button"]),
.ffsa-public textarea,
.ffsa-public select {
  width: 100%;
  padding: 11px 14px;
  border-radius: 0;
  border: 2px solid ${tk.border};
  background: ${tk.cardElev};
  color: ${tk.text};
  font-family: Helvetica,Arial,sans-serif;
  font-size: 15px;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}
.ffsa-public select {
  background-image: url("data:image/svg+xml,${chevronSvg}");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 12px 8px;
  padding-right: 36px;
}
.ffsa-public input:focus, .ffsa-public textarea:focus, .ffsa-public select:focus {
  border-color: ${tk.yellow};
  box-shadow: 0 0 0 3px ${tk.yellow}55;
}
.ffsa-public input::placeholder, .ffsa-public textarea::placeholder {
  color: ${tk.textDim};
}
.ffsa-public label {
  color: ${tk.text};
}
.ffsa-public-btn-primary {
  background: ${tk.border};
  color: ${tk.card};
  font-family: 'Arial Black','Helvetica Neue',Arial,sans-serif;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 13px;
  padding: 14px 30px;
  border-radius: 0;
  border: 2px solid ${tk.border};
  cursor: pointer;
  transition: background .15s ease, color .15s ease, transform .04s ease;
}
.ffsa-public-btn-primary:hover:not(:disabled) {
  background: ${tk.yellow};
  color: ${tk.border};
}
.ffsa-public-btn-primary:active:not(:disabled) {
  transform: translateY(1px);
}
.ffsa-public-btn-primary:disabled {
  background: ${tk.borderSoft};
  color: ${tk.textDim};
  border-color: ${tk.borderSoft};
  cursor: not-allowed;
}
.ffsa-public-btn-ghost {
  background: transparent;
  color: ${tk.text};
  font-family: 'Courier New',Courier,monospace;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 10px 14px;
  border: none;
  cursor: pointer;
  transition: color .15s ease;
}
.ffsa-public-btn-ghost:hover:not(:disabled) {
  color: ${tk.textDimmer};
}
.ffsa-public-card {
  background: ${tk.cardElev};
  border: 2px solid ${tk.border};
  border-radius: 0;
  padding: 14px 16px;
}
.ffsa-public-card.is-selected {
  border-color: ${tk.border};
  background: ${tk.yellow}33;
}
.ffsa-public-error {
  color: ${tk.red};
  font-family: 'Courier New',Courier,monospace;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-top: 6px;
}
.ffsa-public-label {
  display: block;
  font-family: 'Courier New',Courier,monospace;
  font-size: 11px;
  font-weight: 700;
  color: ${tk.text};
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.ffsa-public-label-required::after {
  content: ' *';
  color: ${tk.red};
}
`;
    return <style dangerouslySetInnerHTML={{ __html: css }} />;
  }

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
