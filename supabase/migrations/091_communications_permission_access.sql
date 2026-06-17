-- Migration 091: communications tables honor communications.* permissions (additive)
--
-- Companion to the API-layer canManageComms() change. The campaigns / sender
-- tables gated WRITES on legacy roles only (is_admin / comms_admin), so staff
-- granted the granular communications permissions (communications.send_emails,
-- send_announcements, manage_templates, campaigns.draft) but lacking the
-- comms_admin role could not create or edit campaigns — they hit the comms
-- role check (now fixed in the API) and the DB policy below.
--
-- This adds those permission keys alongside the existing role branches on the
-- write (FOR ALL) policy of each table. Reads on these tables are already open
-- to any authenticated user, so the SELECT policies are left untouched.
-- campaigns are actually SENT through the service-role admin client (RLS
-- bypassed), so the send-only key (campaigns.send) is enforced at the API layer
-- and is intentionally NOT added here.
--
-- Purely additive: every existing is_admin()/comms_admin branch is preserved.

-- ============ campaigns ============
DROP POLICY IF EXISTS "Admins and comms can manage campaigns" ON public.campaigns;
CREATE POLICY "Admins and comms can manage campaigns"
  ON public.campaigns FOR ALL
  USING (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  )
  WITH CHECK (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  );

-- ============ campaign_recipients ============
DROP POLICY IF EXISTS "Admins and comms can manage campaign recipients" ON public.campaign_recipients;
CREATE POLICY "Admins and comms can manage campaign recipients"
  ON public.campaign_recipients FOR ALL
  USING (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  )
  WITH CHECK (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  );

-- ============ campaign_labels ============
DROP POLICY IF EXISTS "Admins and comms can manage campaign labels" ON public.campaign_labels;
CREATE POLICY "Admins and comms can manage campaign labels"
  ON public.campaign_labels FOR ALL
  USING (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  )
  WITH CHECK (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  );

-- ============ sending_identities (sender + brand config) ============
DROP POLICY IF EXISTS "Admins can manage sending identities" ON public.sending_identities;
CREATE POLICY "Admins can manage sending identities"
  ON public.sending_identities FOR ALL
  USING (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  )
  WITH CHECK (
    public.is_admin() OR public.has_role('comms_admin')
    OR public.has_permission('communications.send_emails')
    OR public.has_permission('communications.send_announcements')
    OR public.has_permission('communications.manage_templates')
    OR public.has_permission('campaigns.draft')
  );
