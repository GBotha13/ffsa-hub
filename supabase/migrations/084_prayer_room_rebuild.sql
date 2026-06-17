-- ============================================================
-- FFSA Hub — Prayer Room REBUILD (weekly-template model)
-- ============================================================
-- Replaces the bottom-up "series sign-up → auto-generate slots" model
-- (migration 013) with a top-down weekly template that instantiates into
-- editable devo SETS, owned and rostered by APPROVED members, filled via
-- invite → accept/decline, governed by a multi-step approval pipeline.
--
-- KEEPS: public.user_labels + public.user_label_assignments  (= "skills")
--        public.roles 'prayer_room_admin' (013) + permission 'prayer_room.manage' (014)
-- DROPS: prayer_room_series / _slots / _slot_members / _eval_requests
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. TEARDOWN (clean rebuild — no data preserved; labels kept)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.prayer_room_slot_members  CASCADE;
DROP TABLE IF EXISTS public.prayer_room_slots         CASCADE;
DROP TABLE IF EXISTS public.prayer_room_series        CASCADE;
DROP TABLE IF EXISTS public.prayer_room_eval_requests CASCADE;

-- Needed for the double-booking EXCLUDE constraint (gist on scalar uuid + range)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ────────────────────────────────────────────────────────────
-- 1. APPROVED-MEMBER PROFILE
--    One row per approved person. Created on approval; archived
--    (never deleted) on turnover. Skills live in user_label_assignments.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prayer_room_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'on_break', 'archived')),
  is_evaluator   boolean NOT NULL DEFAULT false,
  is_coordinator boolean NOT NULL DEFAULT false,
  approved_at    timestamptz NOT NULL DEFAULT now(),
  approved_by    uuid REFERENCES public.users(id),
  reeval_due_at  timestamptz,            -- room for v-future periodic re-evaluation
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prm_status      ON public.prayer_room_members(status);
CREATE INDEX idx_prm_evaluator   ON public.prayer_room_members(user_id) WHERE is_evaluator;
CREATE INDEX idx_prm_coordinator ON public.prayer_room_members(user_id) WHERE is_coordinator;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. SETTINGS (singleton — operating window + default block length)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prayer_room_settings (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),  -- enforces a single row
  window_start          time NOT NULL DEFAULT '05:00',
  window_end            time NOT NULL DEFAULT '23:59',
  default_block_minutes integer NOT NULL DEFAULT 120 CHECK (default_block_minutes > 0),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES public.users(id)
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. WEEKLY TEMPLATE BLOCKS (the standing grid, ~65 rows)
--    role_needs seeds each instantiated set's roster, e.g.
--    {"worship_leader":1,"vocals":2,"instrument":2,"prayer_leader":1}
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prayer_room_template_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0 = Sunday
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  title       text,
  role_needs  jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tpl_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX idx_prtb_dow ON public.prayer_room_template_blocks(day_of_week) WHERE is_active;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_template_blocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. DEVO SETS (one scheduled block instance — template-born or ad-hoc)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prayer_room_sets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_block_id uuid REFERENCES public.prayer_room_template_blocks(id) ON DELETE SET NULL,
  week_start        date,            -- Sunday that begins the week; NULL for ad-hoc
  owner_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_date          date NOT NULL,
  start_time        time NOT NULL,
  end_time          time NOT NULL,
  title             text,
  theme             text,
  scripture         text,
  prayer_focus      text,
  setlist           text,            -- notes-and-links blob (enough for v1)
  status            text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  completed_at      timestamptz,
  created_by        uuid REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT set_end_after_start CHECK (end_time > start_time),
  -- idempotent week instantiation: one generated set per block per day.
  -- (NULLs are distinct in Postgres, so ad-hoc sets are unconstrained.)
  CONSTRAINT uq_set_template_date UNIQUE (template_block_id, set_date)
);

CREATE INDEX idx_prs_date        ON public.prayer_room_sets(set_date);
CREATE INDEX idx_prs_date_status ON public.prayer_room_sets(set_date, status);
CREATE INDEX idx_prs_week        ON public.prayer_room_sets(week_start);
CREATE INDEX idx_prs_owner       ON public.prayer_room_sets(owner_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_sets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. ROSTER SLOTS (positions WITH lifecycle)
--    A slot exists from set creation. "open" = a real row awaiting a person.
--    open → invited → filled ;  invited → open (decline) ;  filled → open (removal)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prayer_room_set_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id            uuid NOT NULL REFERENCES public.prayer_room_sets(id) ON DELETE CASCADE,
  role              text NOT NULL
                    CHECK (role IN ('worship_leader', 'vocals', 'instrument', 'prayer_leader')),
  required_label_id uuid REFERENCES public.user_labels(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'invited', 'filled', 'declined')),
  filled_user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invitee_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invited_by        uuid REFERENCES public.users(id),
  invited_at        timestamptz,
  responded_at      timestamptz,
  position          smallint NOT NULL DEFAULT 0,
  occupied_range    tstzrange,   -- denormalized from parent set (trigger-maintained)
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_state_consistent CHECK (
    (status = 'filled'  AND filled_user_id IS NOT NULL) OR
    (status = 'invited' AND invitee_id     IS NOT NULL) OR
    (status IN ('open', 'declined'))
  )
);

CREATE INDEX idx_prss_set     ON public.prayer_room_set_slots(set_id);
CREATE INDEX idx_prss_filled  ON public.prayer_room_set_slots(filled_user_id) WHERE filled_user_id IS NOT NULL;
CREATE INDEX idx_prss_invitee ON public.prayer_room_set_slots(invitee_id)     WHERE status = 'invited';
CREATE INDEX idx_prss_open    ON public.prayer_room_set_slots(role)           WHERE status = 'open';

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_set_slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5a. double-booking prevention ───────────────────────────
-- Maintain occupied_range from the parent set ONLY when filled; NULL otherwise
-- (so open/invited rows never block). SAST (Africa/Johannesburg) has no DST, so
-- the local-time → tstzrange conversion is unambiguous.
CREATE OR REPLACE FUNCTION public.prayer_room_set_slot_range()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NEW.status = 'filled' AND NEW.filled_user_id IS NOT NULL THEN
    SELECT set_date, start_time, end_time INTO s
      FROM public.prayer_room_sets WHERE id = NEW.set_id;
    NEW.occupied_range := tstzrange(
      (s.set_date + s.start_time) AT TIME ZONE 'Africa/Johannesburg',
      (s.set_date + s.end_time)   AT TIME ZONE 'Africa/Johannesburg',
      '[)');
  ELSE
    NEW.occupied_range := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prss_range BEFORE INSERT OR UPDATE ON public.prayer_room_set_slots
  FOR EACH ROW EXECUTE FUNCTION public.prayer_room_set_slot_range();

ALTER TABLE public.prayer_room_set_slots
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (filled_user_id WITH =, occupied_range WITH &&)
  WHERE (status = 'filled' AND filled_user_id IS NOT NULL);

-- If a set's time changes, re-touch its filled slots so occupied_range recomputes
-- (re-fires the BEFORE trigger above; a stale overlap will correctly raise 23P01).
CREATE OR REPLACE FUNCTION public.prayer_room_refresh_slot_ranges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.set_date <> OLD.set_date
     OR NEW.start_time <> OLD.start_time
     OR NEW.end_time <> OLD.end_time THEN
    UPDATE public.prayer_room_set_slots
       SET status = status
     WHERE set_id = NEW.id AND status = 'filled';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prs_refresh_ranges AFTER UPDATE ON public.prayer_room_sets
  FOR EACH ROW EXECUTE FUNCTION public.prayer_room_refresh_slot_ranges();

-- ────────────────────────────────────────────────────────────
-- 6. APPROVAL PIPELINE
--    application (durable case) → assign evaluator → evaluation (the meeting) → decide
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.prayer_room_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'applied'
                CHECK (status IN ('applied','assigned','evaluated','approved','denied','withdrawn')),
  background    text,
  evaluator_id  uuid REFERENCES public.users(id),
  assigned_by   uuid REFERENCES public.users(id),
  assigned_at   timestamptz,
  decided_by    uuid REFERENCES public.users(id),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- one in-flight application per person; re-apply allowed once terminal
CREATE UNIQUE INDEX uq_pra_one_active ON public.prayer_room_applications(applicant_id)
  WHERE status IN ('applied', 'assigned', 'evaluated');
CREATE INDEX idx_pra_status    ON public.prayer_room_applications(status);
CREATE INDEX idx_pra_evaluator ON public.prayer_room_applications(evaluator_id) WHERE evaluator_id IS NOT NULL;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- skills the applicant wants to serve in (reuses the label taxonomy)
CREATE TABLE public.prayer_room_application_skills (
  application_id uuid NOT NULL REFERENCES public.prayer_room_applications(id) ON DELETE CASCADE,
  label_id       uuid NOT NULL REFERENCES public.user_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (application_id, label_id)
);

-- the evaluation meeting record (its own table for history)
CREATE TABLE public.prayer_room_evaluations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.prayer_room_applications(id) ON DELETE CASCADE,
  evaluator_id   uuid NOT NULL REFERENCES public.users(id),
  notes          text,
  met_at         timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pre_application ON public.prayer_room_evaluations(application_id);

-- ────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTIONS (mirror is_admin / has_permission style)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_prayer_room_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR public.has_role('prayer_room_admin')
      OR public.has_permission('prayer_room.manage');
$$;

CREATE OR REPLACE FUNCTION public.is_prayer_room_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prayer_room_members m
    WHERE m.user_id = auth.uid() AND m.status = 'active'
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.prayer_room_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_template_blocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_sets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_set_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_applications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_application_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_room_evaluations       ENABLE ROW LEVEL SECURITY;

-- members: directory listing readable by all authenticated; staff manage.
-- (No contact columns live here — contact data is on users, gated separately.)
CREATE POLICY "Read members" ON public.prayer_room_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage members" ON public.prayer_room_members
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff())
  WITH CHECK (public.is_prayer_room_staff());

-- settings: read by all; staff manage
CREATE POLICY "Read settings" ON public.prayer_room_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage settings" ON public.prayer_room_settings
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff())
  WITH CHECK (public.is_prayer_room_staff());

-- template blocks: read by all; staff manage
CREATE POLICY "Read template" ON public.prayer_room_template_blocks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage template" ON public.prayer_room_template_blocks
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff())
  WITH CHECK (public.is_prayer_room_staff());

-- sets: public schedule (read all); owner (active member) or staff create/edit/delete
CREATE POLICY "Read sets" ON public.prayer_room_sets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create sets" ON public.prayer_room_sets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_prayer_room_staff()
    OR (owner_id = auth.uid() AND public.is_prayer_room_member())
  );
CREATE POLICY "Update sets" ON public.prayer_room_sets
  FOR UPDATE TO authenticated
  USING (public.is_prayer_room_staff() OR owner_id = auth.uid())
  WITH CHECK (public.is_prayer_room_staff() OR owner_id = auth.uid());
CREATE POLICY "Delete sets" ON public.prayer_room_sets
  FOR DELETE TO authenticated
  USING (public.is_prayer_room_staff() OR owner_id = auth.uid());

-- set slots: read by all; owner-of-set or staff manage; invitee may respond to own invite
CREATE POLICY "Read slots" ON public.prayer_room_set_slots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner or staff manage roster" ON public.prayer_room_set_slots
  FOR ALL TO authenticated
  USING (
    public.is_prayer_room_staff()
    OR EXISTS (SELECT 1 FROM public.prayer_room_sets s
               WHERE s.id = set_id AND s.owner_id = auth.uid())
  )
  WITH CHECK (
    public.is_prayer_room_staff()
    OR EXISTS (SELECT 1 FROM public.prayer_room_sets s
               WHERE s.id = set_id AND s.owner_id = auth.uid())
  );
CREATE POLICY "Invitee responds to own invite" ON public.prayer_room_set_slots
  FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid() AND status = 'invited')
  WITH CHECK (
    (status = 'filled' AND filled_user_id = auth.uid())
    OR status = 'open'
  );

-- applications: applicant (own) / assigned evaluator / staff can read.
-- split UPDATE so an applicant can only withdraw, never advance their own case.
CREATE POLICY "Read own/assigned/staff applications" ON public.prayer_room_applications
  FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR evaluator_id = auth.uid()
    OR public.is_prayer_room_staff()
  );
CREATE POLICY "Applicant creates own application" ON public.prayer_room_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());
CREATE POLICY "Applicant withdraws own" ON public.prayer_room_applications
  FOR UPDATE TO authenticated
  USING (applicant_id = auth.uid() AND status IN ('applied', 'assigned'))
  WITH CHECK (status = 'withdrawn');
CREATE POLICY "Evaluator advances assigned" ON public.prayer_room_applications
  FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid() AND status IN ('assigned', 'evaluated'))
  WITH CHECK (status IN ('evaluated', 'approved', 'denied'));
CREATE POLICY "Staff manage applications" ON public.prayer_room_applications
  FOR ALL TO authenticated
  USING (public.is_prayer_room_staff())
  WITH CHECK (public.is_prayer_room_staff());

-- application skills: follow the parent application's visibility
CREATE POLICY "Read application skills" ON public.prayer_room_application_skills
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prayer_room_applications a
    WHERE a.id = application_id
      AND (a.applicant_id = auth.uid() OR a.evaluator_id = auth.uid() OR public.is_prayer_room_staff())
  ));
CREATE POLICY "Applicant sets own application skills" ON public.prayer_room_application_skills
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prayer_room_applications a
    WHERE a.id = application_id AND a.applicant_id = auth.uid() AND a.status = 'applied'
  ));
CREATE POLICY "Applicant or staff remove application skills" ON public.prayer_room_application_skills
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prayer_room_applications a
    WHERE a.id = application_id
      AND ((a.applicant_id = auth.uid() AND a.status = 'applied') OR public.is_prayer_room_staff())
  ));

-- evaluations: assigned evaluator + staff (NOT the applicant)
CREATE POLICY "Evaluator/staff read evaluations" ON public.prayer_room_evaluations
  FOR SELECT TO authenticated
  USING (evaluator_id = auth.uid() OR public.is_prayer_room_staff());
CREATE POLICY "Evaluator/staff write evaluations" ON public.prayer_room_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (evaluator_id = auth.uid() OR public.is_prayer_room_staff());

-- ────────────────────────────────────────────────────────────
-- 9. COVERAGE VIEW (open positions across the schedule; UI lands in v2)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.prayer_room_open_slots AS
SELECT s.week_start,
       s.set_date,
       s.start_time,
       s.end_time,
       s.id    AS set_id,
       s.title,
       slot.id AS slot_id,
       slot.role,
       slot.required_label_id
FROM public.prayer_room_set_slots slot
JOIN public.prayer_room_sets s ON s.id = slot.set_id
WHERE slot.status = 'open'
  AND s.status = 'scheduled';

-- ────────────────────────────────────────────────────────────
-- 10. SEEDS
-- ────────────────────────────────────────────────────────────
-- role + permission already exist (013, 014); keep idempotent for fresh DBs
INSERT INTO public.roles (name, display_name, description, is_system)
VALUES ('prayer_room_admin', 'Prayer Room Admin',
        'Coordinates the prayer room: assigns evaluators, designates evaluators, manages the directory and schedule', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.permissions (module, key, display_name, sort_order)
VALUES ('prayer-room', 'prayer_room.manage', 'Manage Prayer Room', 10)
ON CONFLICT (key) DO NOTHING;

-- singleton settings row
INSERT INTO public.prayer_room_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- extend the skill vocabulary to the brief's list (keeps existing labels)
INSERT INTO public.user_labels (name, category) VALUES
  ('Worship Leader', 'ministry_role'),
  ('Prayer Leader',  'ministry_role'),
  ('Vocals / BGV',   'instrument'),
  ('Acoustic Guitar','instrument'),
  ('Electric Guitar','instrument'),
  ('Bass',           'instrument'),
  ('Keys',           'instrument'),
  ('Drums',          'instrument')
ON CONFLICT (name) DO NOTHING;
