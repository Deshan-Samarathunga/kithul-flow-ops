-- Clean up users table
-- Remove the first 6 rows (ids 1-6) and drop the email column

-- First, delete the rows with ids 1-6
DELETE FROM public.users WHERE id IN (1, 2, 3, 4, 5, 6);

-- Drop the email column
ALTER TABLE public.users DROP COLUMN IF EXISTS email;

-- Verify the cleanup
SELECT id, user_id, name, role, created_at FROM public.users ORDER BY id;
