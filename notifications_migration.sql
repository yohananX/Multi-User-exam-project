-- ═══════════════════════════════════════════════════════════════════
-- notifications_migration.sql
-- Run this entire file in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Notifications table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id              BIGSERIAL PRIMARY KEY,
  recipient_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_role  TEXT NOT NULL CHECK (recipient_role IN ('teacher','school_admin','super_admin')),
  type            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  link            TEXT,
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, read, created_at DESC);

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;


-- ─── 2. Trigger: new teacher → notify all admins ────────────────

CREATE OR REPLACE FUNCTION public.notify_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link)
  SELECT
    admin.id,
    admin.role,
    'new_teacher',
    'New teacher joined',
    NEW.full_name || ' created an account and is pending setup.',
    '/admin/teachers'
  FROM public.users admin
  WHERE admin.role IN ('school_admin', 'super_admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_teacher ON public.users;
CREATE TRIGGER trg_notify_new_teacher
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.role = 'teacher')
  EXECUTE FUNCTION public.notify_new_teacher();


-- ─── 3. Trigger: image uploaded → notify all admins ─────────────

CREATE OR REPLACE FUNCTION public.notify_script_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_subject_name TEXT;
  v_class_name   TEXT;
BEGIN
  SELECT s.name, c.name INTO v_subject_name, v_class_name
  FROM public.subjects s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = NEW.subject_id;

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link)
  SELECT
    admin.id,
    admin.role,
    'script_uploaded',
    'New exam script uploaded',
    'A script was uploaded for ' || COALESCE(v_subject_name, 'unknown subject')
      || ' (' || COALESCE(v_class_name, 'unknown class') || ')',
    '/admin/subjects/' || NEW.subject_id
  FROM public.users admin
  WHERE admin.role IN ('school_admin', 'super_admin');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_script_uploaded ON public.images;
CREATE TRIGGER trg_notify_script_uploaded
  AFTER INSERT ON public.images
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_script_uploaded();


-- ─── 4. Trigger: subject completed → notify assigned teacher ────

CREATE OR REPLACE FUNCTION public.notify_subject_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link)
  SELECT
    ta.teacher_id,
    'teacher',
    'subject_completed',
    'Exam processing complete',
    NEW.name || ' has been fully processed and is ready to download.',
    '/uploads'
  FROM public.teacher_assignments ta
  WHERE ta.subject_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subject_completed ON public.subjects;
CREATE TRIGGER trg_notify_subject_completed
  AFTER UPDATE ON public.subjects
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
  EXECUTE FUNCTION public.notify_subject_completed();


-- ─── 5. Trigger: new message → notify recipient ─────────────────

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_recipient_role TEXT;
  v_sender_name    TEXT;
BEGIN
  SELECT u.role INTO v_recipient_role
  FROM public.users u
  WHERE u.auth_id = NEW.recipient_id;

  SELECT COALESCE(u.full_name, 'Someone') INTO v_sender_name
  FROM public.users u
  WHERE u.auth_id = NEW.sender_id;

  IF v_recipient_role IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link)
    SELECT
      u.id,
      v_recipient_role,
      'new_message',
      'New message from ' || v_sender_name,
      LEFT(NEW.body, 60) || CASE WHEN LENGTH(NEW.body) > 60 THEN '…' ELSE '' END,
      '/messages'
    FROM public.users u
    WHERE u.auth_id = NEW.recipient_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();


-- ─── 6. Trigger: new teacher assignment → notify teacher ─────────

CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_subject_name TEXT;
  v_class_name   TEXT;
BEGIN
  SELECT s.name, c.name INTO v_subject_name, v_class_name
  FROM public.subjects s
  LEFT JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = NEW.subject_id;

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link)
  VALUES (
    NEW.teacher_id,
    'teacher',
    'new_assignment',
    'New subject assigned',
    'You have been assigned to teach ' || COALESCE(v_subject_name, 'a subject')
      || ' in ' || COALESCE(v_class_name, 'a class') || '.',
    '/'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_assignment ON public.teacher_assignments;
CREATE TRIGGER trg_notify_new_assignment
  AFTER INSERT ON public.teacher_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_assignment();
