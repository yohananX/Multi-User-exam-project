-- ═══════════════════════════════════════════════════════════════════
-- Super Admin User Management
-- Run this AFTER run_all.sql in your Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Allow super_admin to INSERT into users table
DROP POLICY IF EXISTS "Super admins can insert users" ON users;
CREATE POLICY "Super admins can insert users"
  ON users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- 2. Allow super_admin to DELETE any row from users table
DROP POLICY IF EXISTS "Super admins can delete any user" ON users;
CREATE POLICY "Super admins can delete any user"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- 3. SECURITY DEFINER function — deletes user + cascading cleanup.
--    The frontend calls this via supabase.rpc('delete_user_by_admin', { target_user_id })
CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM teacher_assignments WHERE teacher_id = target_user_id;
  DELETE FROM users WHERE id = target_user_id;
END;
$$;
