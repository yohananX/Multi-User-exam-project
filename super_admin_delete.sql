-- ═══════════════════════════════════════════════════════════════════
-- Super Admin Delete Users
-- Run this AFTER run_all.sql in your Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Allow super_admin to DELETE any row from users table
DROP POLICY IF EXISTS "Super admins can delete any user" ON users;
CREATE POLICY "Super admins can delete any user"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- 2. SECURITY DEFINER function — bypasses RLS, handles cascade.
--    The frontend calls this via supabase.rpc('delete_user_by_admin', { target_user_id })
CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up teacher_assignments referencing this user
  DELETE FROM teacher_assignments WHERE teacher_id = target_user_id;
  -- Delete the user profile row (cascades to notifications via FK)
  DELETE FROM users WHERE id = target_user_id;
END;
$$;
