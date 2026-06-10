-- ═══════════════════════════════════════════════════════════════════
-- Release-to-Teacher: subject release workflow
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Add released columns to subjects table
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS released BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subjects_released
  ON subjects(released) WHERE released = true;

-- Step 2: Replace old subject_completed notification trigger
--         with new release-based notification trigger

DROP TRIGGER IF EXISTS trg_notify_subject_completed ON subjects;
DROP FUNCTION IF EXISTS notify_subject_completed();

CREATE OR REPLACE FUNCTION notify_subject_released()
RETURNS TRIGGER AS $$
DECLARE
  assignment RECORD;
  subject_name TEXT;
  class_name TEXT;
BEGIN
  -- Only fire when released flips to true
  IF NEW.released = true AND OLD.released = false THEN
    subject_name := NEW.name;

    SELECT c.name INTO class_name
    FROM classes c WHERE c.id = NEW.class_id;

    FOR assignment IN
      SELECT ta.teacher_id, u.role
      FROM teacher_assignments ta
      JOIN users u ON u.id = ta.teacher_id
      WHERE ta.subject_id = NEW.id
    LOOP
      INSERT INTO notifications (
        recipient_id,
        recipient_role,
        type,
        title,
        body,
        link
      ) VALUES (
        assignment.teacher_id,
        assignment.role,
        'subject_completed',
        'Your exam script is ready',
        subject_name || ' (' || class_name ||
        ') has been processed and is ready to download.',
        '/uploads'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_subject_released
  AFTER UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION notify_subject_released();
