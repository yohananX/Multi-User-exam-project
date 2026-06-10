-- ═══════════════════════════════════════════════════════════════════
-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Fix users table RLS (infinite recursion) ──────────────
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can delete teachers" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;

CREATE POLICY "Anyone can read users"
  ON users FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Service role full access"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 2. Disable RLS on other tables (avoids recursion) ────────
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE images DISABLE ROW LEVEL SECURITY;
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments DISABLE ROW LEVEL SECURITY;

-- ─── 3. Add auth_id to teacher_assignments ────────────────────
ALTER TABLE teacher_assignments ADD COLUMN IF NOT EXISTS auth_id uuid;

-- ─── 4. Create messages table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject_id bigint REFERENCES subjects(id) ON DELETE SET NULL,
  image_id bigint REFERENCES images(id) ON DELETE SET NULL,
  class_id bigint REFERENCES classes(id) ON DELETE SET NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON messages;
CREATE POLICY "Users can read own messages"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark messages read" ON messages;
CREATE POLICY "Users can mark messages read"
  ON messages FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (read = true);

-- ─── 5. Ensure auth_id exists on users too ────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- ─── 6. Auto-profile trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.users (auth_id, username, email, full_name, role, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'teacher'),
    (NEW.raw_user_meta_data ->> 'school_id')::int
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
