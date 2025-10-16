-- Force remove all triggers and functions that might be causing the bucket creation error
-- Run this directly in your PostgreSQL client (pgAdmin, DBeaver, etc.)

-- First, let's see what triggers and functions exist
SELECT 'TRIGGERS ON BUCKETS TABLE:' as info;
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'buckets';

SELECT 'FUNCTIONS WITH TOTAL_AMOUNT:' as info;
SELECT proname, prosrc
FROM pg_proc
WHERE proname LIKE '%total_amount%' OR proname LIKE '%calculate%';

-- Force drop all possible variations of the problematic trigger and function
DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON buckets CASCADE;
DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON public.buckets CASCADE;

-- Drop the function with all possible variations
DROP FUNCTION IF EXISTS calculate_total_amount() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_total_amount() CASCADE;
DROP FUNCTION IF EXISTS calculate_total_amount() RESTRICT;
DROP FUNCTION IF EXISTS public.calculate_total_amount() RESTRICT;

-- Drop any other functions that might be related
DROP FUNCTION IF EXISTS calculate_total_amount(record) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_total_amount(record) CASCADE;

-- Verify they're gone
SELECT 'FINAL CHECK - TRIGGERS:' as info;
SELECT trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'buckets';

SELECT 'FINAL CHECK - FUNCTIONS:' as info;
SELECT proname
FROM pg_proc
WHERE proname = 'calculate_total_amount';

-- If any still exist, show their details
SELECT 'REMAINING PROBLEMATIC FUNCTIONS:' as info;
SELECT proname, prosrc
FROM pg_proc
WHERE proname LIKE '%total_amount%' OR proname LIKE '%calculate%';

-- Add comment to document the fix
COMMENT ON TABLE public.buckets IS 'Buckets table - all problematic triggers and functions removed';
