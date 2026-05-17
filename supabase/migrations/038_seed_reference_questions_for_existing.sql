-- ============================================================
-- Backfill reference questions onto every existing program.
-- ------------------------------------------------------------
-- The seed function is idempotent: programs that already have any
-- reference questions are skipped.
-- ============================================================

DO $$
DECLARE
  v_program_id uuid;
BEGIN
  FOR v_program_id IN
    SELECT id FROM public.programs
  LOOP
    PERFORM public.seed_default_reference_questions(v_program_id);
  END LOOP;
END $$;
