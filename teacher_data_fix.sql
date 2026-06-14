-- ═══════════════════════════════════════════════════════════════════
-- 1. Add missing columns to subjects (causes DownloadsPage 400)
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS term TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS exam_type TEXT;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Auto-populate teacher_assignments.auth_id on INSERT
--    This column exists but is never set — trigger fixes it.
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_teacher_assignment_auth_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT auth_id INTO NEW.auth_id FROM users WHERE id = NEW.teacher_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_teacher_assignment_auth_id ON teacher_assignments;
CREATE TRIGGER trg_set_teacher_assignment_auth_id
  BEFORE INSERT ON teacher_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_teacher_assignment_auth_id();
