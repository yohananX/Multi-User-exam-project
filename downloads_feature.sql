ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS docx_path TEXT;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS imposed_pdf_path TEXT;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS released BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS subject_downloads (
  id              BIGSERIAL PRIMARY KEY,
  subject_id      BIGINT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'downloaded')),
  released_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  downloaded_at   TIMESTAMPTZ,
  UNIQUE(subject_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_downloads_teacher
  ON subject_downloads(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_subject_downloads_subject
  ON subject_downloads(subject_id);

ALTER TABLE subject_downloads DISABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_notify_subject_released ON subjects;
DROP FUNCTION IF EXISTS notify_subject_released();

CREATE OR REPLACE FUNCTION handle_subject_released()
RETURNS TRIGGER AS $$
DECLARE
  assignment RECORD;
  class_name TEXT;
BEGIN
  IF NEW.released = true AND (OLD.released = false OR OLD.released IS NULL) THEN

    SELECT c.name INTO class_name
    FROM classes c WHERE c.id = NEW.class_id;

    FOR assignment IN
      SELECT ta.teacher_id, u.role, u.full_name
      FROM teacher_assignments ta
      JOIN users u ON u.id = ta.teacher_id
      WHERE ta.subject_id = NEW.id
    LOOP
      INSERT INTO subject_downloads (
        subject_id, teacher_id, status, released_at
      ) VALUES (
        NEW.id, assignment.teacher_id, 'new', now()
      ) ON CONFLICT (subject_id, teacher_id) DO NOTHING;

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
        NEW.name || ' (' || class_name ||
        ') has been processed and is ready to download.',
        '/downloads'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_subject_released
  AFTER UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION handle_subject_released();

CREATE OR REPLACE FUNCTION get_new_downloads_count(p_teacher_id BIGINT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM subject_downloads
  WHERE teacher_id = p_teacher_id AND status = 'new';
$$ LANGUAGE sql STABLE;
