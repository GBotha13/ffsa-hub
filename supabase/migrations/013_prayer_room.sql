-- ============================================================
-- FFSA Hub — Prayer Room Module + Global User Labels
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. GLOBAL USER LABELS
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.user_labels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  category   text NOT NULL DEFAULT 'other'
             CHECK (category IN ('ministry_role', 'instrument', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read labels"
  ON public.user_labels FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage labels"
  ON public.user_labels FOR ALL
  USING (public.is_admin() OR public.has_role('prayer_room_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('prayer_room_admin'));

-- ────────────────────────────────────────────────────────────

CREATE TABLE public.user_label_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label_id    uuid NOT NULL REFERENCES public.user_labels(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, label_id)
);

CREATE INDEX idx_ula_user ON public.user_label_assignments(user_id);
CREATE INDEX idx_ula_label ON public.user_label_assignments(label_id);

ALTER TABLE public.user_label_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read label assignments"
  ON public.user_label_assignments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage label assignments"
  ON public.user_label_assignments FOR ALL
  USING (public.is_admin() OR public.has_role('prayer_room_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('prayer_room_admin'));

-- ────────────────────────────────────────────────────────────
-- 2. PRAYER ROOM SERIES (sign-up requests / commitments)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.prayer_room_series (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  commitment_type  text NOT NULL CHECK (commitment_type IN ('quarterly', 'weekly', 'one_off')),
  title            text,
  day_of_week      smallint CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  start_date       date NOT NULL,
  end_date         date,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by      uuid REFERENCES public.users(id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

CREATE INDEX idx_prs_created_by ON public.prayer_room_series(created_by);
CREATE INDEX idx_prs_status ON public.prayer_room_series(status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.prayer_room_series ENABLE ROW LEVEL SECURITY;

-- Everyone can read approved series; users can read their own
CREATE POLICY "Read approved or own series"
  ON public.prayer_room_series FOR SELECT
  USING (
    status = 'approved'
    OR created_by = auth.uid()
    OR public.is_admin()
    OR public.has_role('prayer_room_admin')
  );

CREATE POLICY "Users can create series"
  ON public.prayer_room_series FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can cancel own pending series"
  ON public.prayer_room_series FOR UPDATE
  USING (
    (created_by = auth.uid() AND status = 'pending')
    OR public.is_admin()
    OR public.has_role('prayer_room_admin')
  )
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 3. PRAYER ROOM SLOTS (individual occurrences)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.prayer_room_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id    uuid REFERENCES public.prayer_room_series(id) ON DELETE CASCADE,
  slot_date    date NOT NULL,
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  title        text,
  status       text NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes        text,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prsl_date ON public.prayer_room_slots(slot_date);
CREATE INDEX idx_prsl_date_status ON public.prayer_room_slots(slot_date, status);
CREATE INDEX idx_prsl_series ON public.prayer_room_slots(series_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_room_slots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.prayer_room_slots ENABLE ROW LEVEL SECURITY;

-- Everyone can read scheduled/completed slots (the public schedule)
CREATE POLICY "Anyone can read active slots"
  ON public.prayer_room_slots FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage slots"
  ON public.prayer_room_slots FOR ALL
  USING (public.is_admin() OR public.has_role('prayer_room_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('prayer_room_admin'));

-- ────────────────────────────────────────────────────────────
-- 4. PRAYER ROOM SLOT MEMBERS (created before the policy that references it)
-- ────────────────────────────────────────────────────────────

CREATE TABLE public.prayer_room_slot_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     uuid NOT NULL REFERENCES public.prayer_room_slots(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('worship_leader', 'prayer_leader', 'musician')),
  instrument  text,
  assigned_by uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_id, user_id)
);

CREATE INDEX idx_prsm_slot ON public.prayer_room_slot_members(slot_id);
CREATE INDEX idx_prsm_user ON public.prayer_room_slot_members(user_id);

ALTER TABLE public.prayer_room_slot_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read slot members"
  ON public.prayer_room_slot_members FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage slot members"
  ON public.prayer_room_slot_members FOR ALL
  USING (public.is_admin() OR public.has_role('prayer_room_admin'))
  WITH CHECK (public.is_admin() OR public.has_role('prayer_room_admin'));

-- Members of a slot can update it (for adding notes)
-- Placed here because it references prayer_room_slot_members
CREATE POLICY "Slot members can update"
  ON public.prayer_room_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.prayer_room_slot_members m
      WHERE m.slot_id = id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 5. SEED prayer_room_admin ROLE
-- ────────────────────────────────────────────────────────────

INSERT INTO public.roles (name, display_name, description, is_system)
VALUES ('prayer_room_admin', 'Prayer Room Admin', 'Can approve/reject prayer room sign-ups and manage the schedule', false)
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. SEED DEFAULT LABELS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.user_labels (name, category) VALUES
  ('Worship Leader', 'ministry_role'),
  ('Prayer Leader', 'ministry_role'),
  ('Singer', 'instrument'),
  ('Acoustic Guitar', 'instrument'),
  ('Electric Guitar', 'instrument'),
  ('Bass', 'instrument'),
  ('Piano', 'instrument'),
  ('Drums', 'instrument'),
  ('Cajon', 'instrument')
ON CONFLICT (name) DO NOTHING;
