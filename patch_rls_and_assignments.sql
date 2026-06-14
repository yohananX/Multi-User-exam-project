-- 1. Fix users table RLS update policy to allow updating auth_id when it is NULL and the email matches the authenticated user's email.
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth_id = auth.uid() OR (auth_id IS NULL AND email = auth.jwt() ->> 'email'))
  WITH CHECK (auth_id = auth.uid() OR (auth_id IS NULL AND email = auth.jwt() ->> 'email'));

-- 2. Update existing teacher_assignments rows that have NULL auth_id
UPDATE teacher_assignments ta
SET auth_id = u.auth_id
FROM users u
WHERE ta.teacher_id = u.id AND ta.auth_id IS NULL;

-- 3. Ensure trigger exists to automatically set auth_id for new inserts into teacher_assignments
CREATE OR REPLACE FUNCTION set_teacher_assignment_auth_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.auth_id IS NULL THEN
    SELECT auth_id INTO NEW.auth_id FROM users WHERE id = NEW.teacher_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_teacher_assignment_auth_id ON teacher_assignments;
CREATE TRIGGER trg_set_teacher_assignment_auth_id
  BEFORE INSERT ON teacher_assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_teacher_assignment_auth_id();
