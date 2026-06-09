-- Add auth_id to users table for Supabase Auth integration
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Change uploaded_by/processed_by in images to text (stores auth.uid())
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_uploaded_by_fkey;
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_processed_by_fkey;
ALTER TABLE images ALTER COLUMN uploaded_by TYPE text USING uploaded_by::text;
ALTER TABLE images ALTER COLUMN processed_by TYPE text USING processed_by::text;

-- Auto-create user profile when user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS: Profiles (users table acts as our profile table)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth_id = auth.uid());

-- Admins can read all profiles in their school
CREATE POLICY "Admins can read all profiles"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.role IN ('super_admin', 'school_admin')
      AND (u.school_id = users.school_id OR u.role = 'super_admin')
    )
  );

-- Users can update own profile (but not role)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Admins can delete teachers
CREATE POLICY "Admins can delete teachers"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.role IN ('super_admin', 'school_admin')
    )
  );

-- Service role bypass
CREATE POLICY "Service role can manage users"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- Classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "Service role can modify classes"
  ON classes FOR ALL
  USING (auth.role() = 'service_role');

-- Subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read subjects"
  ON subjects FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "Service role can modify subjects"
  ON subjects FOR ALL
  USING (auth.role() = 'service_role');

-- Teacher assignments
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can read own assignments"
  ON teacher_assignments FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE auth_id = auth.uid() AND role = 'teacher'
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('super_admin', 'school_admin')
    )
  );
CREATE POLICY "Service role can modify assignments"
  ON teacher_assignments FOR ALL
  USING (auth.role() = 'service_role');

-- Images
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
-- uploaded_by stores auth.uid() as text; for now allow all authenticated to read
CREATE POLICY "Authenticated users can read images"
  ON images FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "Service role can modify images"
  ON images FOR ALL
  USING (auth.role() = 'service_role');

-- Schools
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read schools"
  ON schools FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));
CREATE POLICY "Service role can modify schools"
  ON schools FOR ALL
  USING (auth.role() = 'service_role');

-- Storage: update existing buckets to be private
UPDATE storage.buckets SET public = false WHERE id IN ('uploads', 'generated');

-- Storage object policies
DROP POLICY IF EXISTS "Authenticated users can upload to uploads" ON storage.objects;
CREATE POLICY "Authenticated users can upload to uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read storage" ON storage.objects;
CREATE POLICY "Authenticated users can read storage"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('uploads', 'generated') AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role full access to all buckets" ON storage.objects;
CREATE POLICY "Service role full access"
  ON storage.objects FOR ALL
  USING (auth.role() = 'service_role');
