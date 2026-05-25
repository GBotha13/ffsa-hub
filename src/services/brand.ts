// Brand kit per sending identity. The renderer (src/lib/campaigns/blocks.ts)
// asks this module for the effective brand kit at render time. Any field left
// null in the DB falls back to the editorial default below.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "youtube"
  | "x"
  | "tiktok"
  | "web";

export type SocialLink = { platform: SocialPlatform; url: string };

export type BrandKitRow = {
  sending_identity_id: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  text_color: string | null;
  bg_color: string | null;
  display_font: string | null;
  body_font: string | null;
  org_name: string | null;
  org_address: string | null;
  footer_tagline: string | null;
  social_links: SocialLink[];
  updated_at: string | null;
};

// Editorial defaults — strong, magazine-feeling palette and typography.
// Anything the user fills in on the Brand Settings page overrides these.
export const BRAND_DEFAULTS = {
  logo_url: null as string | null,
  primary_color: "#0F172A", // deep slate — headline / header band
  accent_color: "#C2410C", // warm fire-orange — CTAs, links
  text_color: "#1E293B", // body copy
  bg_color: "#F8FAFC", // canvas behind the email card
  display_font: "Fraunces", // editorial serif
  body_font: "Inter", // clean sans
  org_name: "Fire & Fragrance South Africa",
  org_address: "",
  footer_tagline: "",
  social_links: [] as SocialLink[],
} as const;

export type EffectiveBrand = {
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  text_color: string;
  bg_color: string;
  display_font: string;
  body_font: string;
  org_name: string;
  org_address: string;
  footer_tagline: string;
  social_links: SocialLink[];
};

export function mergeBrand(row: BrandKitRow | null): EffectiveBrand {
  return {
    logo_url: row?.logo_url ?? BRAND_DEFAULTS.logo_url,
    primary_color: row?.primary_color || BRAND_DEFAULTS.primary_color,
    accent_color: row?.accent_color || BRAND_DEFAULTS.accent_color,
    text_color: row?.text_color || BRAND_DEFAULTS.text_color,
    bg_color: row?.bg_color || BRAND_DEFAULTS.bg_color,
    display_font: row?.display_font || BRAND_DEFAULTS.display_font,
    body_font: row?.body_font || BRAND_DEFAULTS.body_font,
    org_name: row?.org_name || BRAND_DEFAULTS.org_name,
    org_address: row?.org_address || BRAND_DEFAULTS.org_address,
    footer_tagline: row?.footer_tagline || BRAND_DEFAULTS.footer_tagline,
    social_links: row?.social_links?.length
      ? row.social_links
      : BRAND_DEFAULTS.social_links,
  };
}

export async function getBrandKit(
  supabase: Client,
  identityId: string
): Promise<BrandKitRow | null> {
  const { data } = await supabase
    .from("sending_identity_brands")
    .select("*")
    .eq("sending_identity_id", identityId)
    .maybeSingle();
  return (data ?? null) as BrandKitRow | null;
}

export async function getEffectiveBrand(
  supabase: Client,
  identityId: string | null | undefined
): Promise<EffectiveBrand> {
  if (!identityId) return mergeBrand(null);
  const row = await getBrandKit(supabase, identityId);
  return mergeBrand(row);
}

export type BrandKitPatch = Partial<Omit<BrandKitRow, "sending_identity_id" | "updated_at">>;

export async function upsertBrandKit(
  supabase: Client,
  identityId: string,
  patch: BrandKitPatch,
  updatedBy: string | null
) {
  const row = {
    sending_identity_id: identityId,
    ...patch,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  return supabase
    .from("sending_identity_brands")
    .upsert(row, { onConflict: "sending_identity_id" })
    .select()
    .single();
}
