-- ============================================================================
-- Migration: Add Cascade Delete Trigger from auth.users to public.users
-- ============================================================================
-- 
-- This trigger ensures that when a user is deleted from auth.users (Supabase Auth),
-- the corresponding record in public.users is also deleted, which will cascade
-- to all child tables (trades, accounts, etc.) via Prisma's onDelete: Cascade.
--
-- ============================================================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete the corresponding record from public.users
    -- This will cascade to all child tables via Prisma's onDelete: Cascade
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

-- Create the trigger on auth.users
-- Note: This requires superuser/owner privileges on auth schema
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_user_delete();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;

-- ============================================================================
-- IMPORTANT: If you cannot create triggers on auth.users directly,
-- you can run this SQL directly in the Supabase SQL Editor with admin privileges.
-- ============================================================================
