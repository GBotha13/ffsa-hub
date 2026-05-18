-- ============================================================
-- FFSA Hub — Migration 045: Campaigns + campaign recipients
-- ============================================================
-- A campaign is a single marketing email send. v1 = one label
-- per campaign as audience. Body is stored both as rendered
-- HTML (body_html, what actually goes out) and as composer
-- source (body_source, Tiptap JSON for re-editing drafts).
--
-- Also adds the deferred FK from activity_events.related_campaign_id
-- AND from forms.welcome_campaign_id back to this table.
--
-- Spec: FFSA_Hub_CRM_Spec.md §3.6, §7
-- ============================================================

CREATE TABLE public.campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  subject             text NOT NULL,
  preview_text        text,
  body_html           text NOT NULL,
  body_source         jsonb,
  label_id            uuid NOT NULL REFERENCES public.labels(id) ON DELETE RESTRICT,
  sending_identity_id uuid NOT NULL REFERENCES public.sending_identities(id) ON DELETE RESTRICT,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_label    ON public.campaigns (label_id);
CREATE INDEX idx_campaigns_status   ON public.campaigns (status);
CREATE INDEX idx_campaigns_schedule ON public.campaigns (scheduled_at)
  WHERE status = 'scheduled';

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage campaigns"
  ON public.campaigns FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

COMMENT ON TABLE public.campaigns IS
  'Marketing email sends. Audience = contacts holding label_id, minus unsubscribes and suppressions, minus marketing_status != subscribed.';

COMMENT ON COLUMN public.campaigns.body_source IS
  'Composer source (Tiptap JSON) for re-editing drafts. body_html is the authoritative rendered output sent to the provider.';

-- ────────────────────────────────────────────────────────────
-- campaign_recipients
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.campaign_recipients (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id           uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  provider_message_id  text,
  sent_at              timestamptz,
  delivered_at         timestamptz,
  opened_at            timestamptz,
  first_clicked_at     timestamptz,
  bounced_at           timestamptz,
  bounce_reason        text,
  complained_at        timestamptz,
  unsubscribed_at      timestamptz,
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX idx_campaign_recipients_message  ON public.campaign_recipients (provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients (campaign_id);
CREATE INDEX idx_campaign_recipients_contact  ON public.campaign_recipients (contact_id);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read campaign recipients"
  ON public.campaign_recipients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and comms can manage campaign recipients"
  ON public.campaign_recipients FOR ALL
  USING (public.is_admin() OR public.has_role('comms_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('comms_admin'));

-- ────────────────────────────────────────────────────────────
-- Backfill deferred FKs
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.activity_events
  ADD CONSTRAINT activity_events_related_campaign_id_fkey
  FOREIGN KEY (related_campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.forms
  ADD CONSTRAINT forms_welcome_campaign_id_fkey
  FOREIGN KEY (welcome_campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- ============================================================
-- Validation
-- ------------------------------------------------------------
--   SELECT count(*) FROM public.campaigns;            -- 0
--   SELECT count(*) FROM public.campaign_recipients;  -- 0
--
--   SELECT conname FROM pg_constraint
--   WHERE conname IN (
--     'activity_events_related_campaign_id_fkey',
--     'forms_welcome_campaign_id_fkey'
--   );
--   -- expect both
-- ============================================================
