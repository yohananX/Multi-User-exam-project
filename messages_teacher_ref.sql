-- Add teacher_ref_id column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS teacher_ref_id bigint;

CREATE INDEX IF NOT EXISTS idx_messages_teacher_ref ON messages(teacher_ref_id);
