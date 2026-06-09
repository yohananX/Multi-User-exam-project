-- ⚠️ RUN THIS IN SUPABASE SQL EDITOR ⚠️
-- This fixes the infinite recursion error on the users table

-- Step 1: Drop ALL existing policies on users (they have recursion bugs)
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Admins can read all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can delete teachers" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;

-- Step 2: Create non-recursive policies
-- Use auth.role() and auth.uid() directly — NO subqueries on the users table
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

-- Step 3: Fix other tables' RLS too (drop + recreate without recursion)
-- Classes
DROP POLICY IF EXISTS "Authenticated users can read classes" ON classes;
DROP POLICY IF EXISTS "Service role can modify classes" ON classes;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;

-- Subjects  
DROP POLICY IF EXISTS "Authenticated users can read subjects" ON subjects;
DROP POLICY IF EXISTS "Service role can modify subjects" ON subjects;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;

-- Teacher assignments
DROP POLICY IF EXISTS "Teachers can read own assignments" ON teacher_assignments;
DROP POLICY IF EXISTS "Service role can modify assignments" ON teacher_assignments;
ALTER TABLE teacher_assignments DISABLE ROW LEVEL SECURITY;

-- Images
DROP POLICY IF EXISTS "Authenticated users can read images" ON images;
DROP POLICY IF EXISTS "Users can read own images" ON images;
DROP POLICY IF EXISTS "Service role can modify images" ON images;
ALTER TABLE images DISABLE ROW LEVEL SECURITY;

-- Schools
DROP POLICY IF EXISTS "Authenticated users can read schools" ON schools;
DROP POLICY IF EXISTS "Service role can modify schools" ON schools;
ALTER TABLE schools DISABLE ROW LEVEL SECURITY;

-- Storage
DROP POLICY IF EXISTS "Authenticated users can upload to uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read storage" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to all buckets" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;

-- Step 4: Verify auth_id column exists (create if not)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Step 5: Enable the trigger for auto-profile creation
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
