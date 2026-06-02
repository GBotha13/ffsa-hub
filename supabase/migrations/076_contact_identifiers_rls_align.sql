-- ============================================================
-- Align contact_emails / contact_phones RLS with the contacts module.
--
-- Migration 068 gated these two tables on the GRANULAR permission system
-- (has_permission('contacts.read' / 'contacts.write')), but the contacts
-- table itself (migration 005) is gated on ROLES
-- (has_any_role['super_admin','admin','staff','events_admin']).
--
-- Result: a role-based admin/staff member WITHOUT an explicit
-- contacts.read permission row could read the contacts table (and the
-- list view, which shows the email/phone cache columns) but got ZERO
-- rows from contact_emails / contact_phones — the "No email on file"
-- bug on the contact profile.
--
-- Fix: make identifier visibility & editing match the contacts table —
-- anyone who can read/write a contact can read/write its emails & phones.
-- The granular has_permission() path is preserved (OR), and a person can
-- see their own identifiers, mirroring the contacts SELECT policies.
-- ============================================================

DROP POLICY IF EXISTS contact_emails_select ON public.contact_emails;
DROP POLICY IF EXISTS contact_emails_all    ON public.contact_emails;
DROP POLICY IF EXISTS contact_phones_select ON public.contact_phones;
DROP POLICY IF EXISTS contact_phones_all    ON public.contact_phones;

-- ── contact_emails ──
CREATE POLICY contact_emails_select
  ON public.contact_emails FOR SELECT
  USING (
    public.has_any_role(ARRAY['super_admin', 'admin', 'staff', 'events_admin'])
    OR public.has_permission('contacts.read')
    OR contact_id = public.get_my_contact_id()
  );

CREATE POLICY contact_emails_all
  ON public.contact_emails FOR ALL
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('contacts.write')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('contacts.write')
  );

-- ── contact_phones ──
CREATE POLICY contact_phones_select
  ON public.contact_phones FOR SELECT
  USING (
    public.has_any_role(ARRAY['super_admin', 'admin', 'staff', 'events_admin'])
    OR public.has_permission('contacts.read')
    OR contact_id = public.get_my_contact_id()
  );

CREATE POLICY contact_phones_all
  ON public.contact_phones FOR ALL
  USING (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('contacts.write')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_role('events_admin')
    OR public.has_permission('contacts.write')
  );
