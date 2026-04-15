-- ============================================================
-- FFSA Hub — Xero Integration
-- ============================================================
-- Stores OAuth2 tokens for the Xero connection.
-- One row per organization (single-tenant for now).
-- ============================================================

CREATE TABLE public.xero_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  tenant_name     text,
  access_token    text NOT NULL,
  refresh_token   text NOT NULL,
  expires_at      timestamptz NOT NULL,
  token_set       jsonb,
  connected_by    uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.xero_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.xero_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage xero tokens"
  ON public.xero_tokens FOR ALL
  USING (public.is_admin() OR public.has_role('finance_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('finance_admin'));

-- Track which student fees have had Xero invoices created
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS xero_invoice_id text;
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS xero_invoice_number text;
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS xero_invoice_url text;
