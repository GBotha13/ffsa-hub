-- Migration 090: event satellite tables honor events.* permissions (additive)
--
-- Companion to migration 086 (core events / event_registrations) and the
-- API-layer canManageEvents() change. The event satellite tables still gated
-- WRITES on legacy roles only (is_admin / events_admin / comms_admin), so a
-- staff member with events.create but no managing role passed the API gate and
-- then failed at the database ("new row violates row-level security policy")
-- when saving forms, ticket tiers, outcomes, event roles, or workflows.
--
-- This adds an has_permission('events.create') branch to each write policy.
-- Reads on the pure-event tables are already open to any authenticated user,
-- so those SELECT policies are left untouched.
--
-- forms / form_submissions are SHARED with the communications module, so their
-- events branch is scoped to event-linked rows (event_id IS NOT NULL) — events
-- staff get access to event forms only, never standalone comms forms.
--
-- Purely additive: every existing role/admin branch is preserved verbatim.

-- ============ event_outcomes ============
DROP POLICY IF EXISTS "Admins and events can manage event outcomes" ON public.event_outcomes;
CREATE POLICY "Admins and events can manage event outcomes"
  ON public.event_outcomes FOR ALL
  USING (is_admin() OR has_role('events_admin') OR has_role('comms_admin') OR has_permission('events.create'))
  WITH CHECK (is_admin() OR has_role('events_admin') OR has_role('comms_admin') OR has_permission('events.create'));

-- ============ event_outcome_responses ============
DROP POLICY IF EXISTS "Admins and events can manage outcome responses" ON public.event_outcome_responses;
CREATE POLICY "Admins and events can manage outcome responses"
  ON public.event_outcome_responses FOR ALL
  USING (is_admin() OR has_role('events_admin') OR has_role('comms_admin') OR has_permission('events.create'))
  WITH CHECK (is_admin() OR has_role('events_admin') OR has_role('comms_admin') OR has_permission('events.create'));

-- ============ event_roles ============
DROP POLICY IF EXISTS "Admins and events can manage event roles" ON public.event_roles;
CREATE POLICY "Admins and events can manage event roles"
  ON public.event_roles FOR ALL
  USING (is_admin() OR has_role('events_admin') OR has_permission('events.create'))
  WITH CHECK (is_admin() OR has_role('events_admin') OR has_permission('events.create'));

-- ============ outcome_workflows ============
DROP POLICY IF EXISTS "Admins and events can manage outcome workflows" ON public.outcome_workflows;
CREATE POLICY "Admins and events can manage outcome workflows"
  ON public.outcome_workflows FOR ALL
  USING (is_admin() OR has_role('events_admin') OR has_role('comms_admin') OR has_permission('events.create'))
  WITH CHECK (is_admin() OR has_role('events_admin') OR has_role('comms_admin') OR has_permission('events.create'));

-- ============ ticket_types ============
DROP POLICY IF EXISTS "Admins and events can manage ticket types" ON public.ticket_types;
CREATE POLICY "Admins and events can manage ticket types"
  ON public.ticket_types FOR ALL
  USING (is_admin() OR has_role('events_admin') OR has_permission('events.create'))
  WITH CHECK (is_admin() OR has_role('events_admin') OR has_permission('events.create'));

-- ============ forms (shared with comms — scope events branch to event forms) ============
DROP POLICY IF EXISTS "Admins and comms can manage forms" ON public.forms;
CREATE POLICY "Admins and comms can manage forms"
  ON public.forms FOR ALL
  USING (is_admin() OR has_role('comms_admin') OR (event_id IS NOT NULL AND has_permission('events.create')))
  WITH CHECK (is_admin() OR has_role('comms_admin') OR (event_id IS NOT NULL AND has_permission('events.create')));

DROP POLICY IF EXISTS "Active forms readable by anyone" ON public.forms;
CREATE POLICY "Active forms readable by anyone"
  ON public.forms FOR SELECT
  USING (
    is_active = true
    OR is_admin()
    OR has_role('comms_admin')
    OR (event_id IS NOT NULL AND (has_permission('events.view') OR has_permission('events.create')))
  );

-- ============ form_submissions (shared with comms — scope to event forms) ============
DROP POLICY IF EXISTS "Admins and comms can insert submissions" ON public.form_submissions;
CREATE POLICY "Admins and comms can insert submissions"
  ON public.form_submissions FOR INSERT
  WITH CHECK (
    is_admin()
    OR has_role('comms_admin')
    OR (
      has_permission('events.create')
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_submissions.form_id AND f.event_id IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "Admins and comms can read submissions" ON public.form_submissions;
CREATE POLICY "Admins and comms can read submissions"
  ON public.form_submissions FOR SELECT
  USING (
    is_admin()
    OR has_role('comms_admin')
    OR (
      (has_permission('events.view') OR has_permission('events.create'))
      AND EXISTS (
        SELECT 1 FROM public.forms f
        WHERE f.id = form_submissions.form_id AND f.event_id IS NOT NULL
      )
    )
  );
