-- Migration 087: contacts RLS accepts granular contacts.* permissions (additive, mirrors 081/086)
--
-- The core contact tables gated writes/reads on legacy roles only
-- (is_admin / has_role('events_admin') / has_any_role(...)), ignoring the
-- granular contacts.* permissions granted by the permission manager. Staff
-- granted e.g. contacts.edit but without an admin role were blocked
-- ("new row violates row-level security policy") or saw empty contact lists.
-- This adds has_permission(...) branches alongside every existing branch.
-- Purely additive: no existing role/admin/self branch is removed.
--
-- Note: the matching app-layer check (canWriteContacts in src/lib/api-auth.ts)
-- is updated in the same change so the admin-client API routes (identifiers,
-- merge) also honor these permissions.

-- ============ contacts ============

-- SELECT (all contacts) -- add contacts.view / contacts.read
DROP POLICY IF EXISTS "Admins and staff can read all contacts" ON public.contacts;
CREATE POLICY "Admins and staff can read all contacts"
  ON public.contacts FOR SELECT
  USING (
    has_any_role(ARRAY['super_admin','admin','staff','events_admin'])
    OR has_permission('contacts.view')
    OR has_permission('contacts.read')
  );

-- INSERT -- add contacts.create / contacts.write
DROP POLICY IF EXISTS "Admins can insert contacts" ON public.contacts;
CREATE POLICY "Admins can insert contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.create')
    OR has_permission('contacts.write')
  );

-- UPDATE -- add contacts.edit / contacts.write
DROP POLICY IF EXISTS "Admins can update contacts" ON public.contacts;
CREATE POLICY "Admins can update contacts"
  ON public.contacts FOR UPDATE
  USING (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.edit')
    OR has_permission('contacts.write')
  )
  WITH CHECK (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.edit')
    OR has_permission('contacts.write')
  );

-- DELETE -- add contacts.delete
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;
CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE
  USING (
    is_admin()
    OR has_permission('contacts.delete')
  );

-- "Users can read own contact record" (id = get_my_contact_id()) is left unchanged.

-- ============ contact_emails ============

DROP POLICY IF EXISTS "contact_emails_select" ON public.contact_emails;
CREATE POLICY "contact_emails_select"
  ON public.contact_emails FOR SELECT
  USING (
    has_any_role(ARRAY['super_admin','admin','staff','events_admin'])
    OR has_permission('contacts.read')
    OR has_permission('contacts.view')
    OR (contact_id = get_my_contact_id())
  );

DROP POLICY IF EXISTS "contact_emails_all" ON public.contact_emails;
CREATE POLICY "contact_emails_all"
  ON public.contact_emails FOR ALL
  USING (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.write')
    OR has_permission('contacts.edit')
    OR has_permission('contacts.create')
  )
  WITH CHECK (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.write')
    OR has_permission('contacts.edit')
    OR has_permission('contacts.create')
  );

-- ============ contact_phones ============

DROP POLICY IF EXISTS "contact_phones_select" ON public.contact_phones;
CREATE POLICY "contact_phones_select"
  ON public.contact_phones FOR SELECT
  USING (
    has_any_role(ARRAY['super_admin','admin','staff','events_admin'])
    OR has_permission('contacts.read')
    OR has_permission('contacts.view')
    OR (contact_id = get_my_contact_id())
  );

DROP POLICY IF EXISTS "contact_phones_all" ON public.contact_phones;
CREATE POLICY "contact_phones_all"
  ON public.contact_phones FOR ALL
  USING (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.write')
    OR has_permission('contacts.edit')
    OR has_permission('contacts.create')
  )
  WITH CHECK (
    is_admin()
    OR has_role('events_admin')
    OR has_permission('contacts.write')
    OR has_permission('contacts.edit')
    OR has_permission('contacts.create')
  );
