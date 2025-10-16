-- MANUAL FIX FOR BUCKET CREATION ERROR
-- Copy and paste these commands into your PostgreSQL client (pgAdmin, DBeaver, etc.)

-- Step 1: Check what triggers exist
SELECT 'CURRENT TRIGGERS ON BUCKETS:' as status;
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'buckets';

-- Step 2: Check what functions exist
SELECT 'CURRENT FUNCTIONS WITH TOTAL_AMOUNT:' as status;
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%total_amount%' OR proname LIKE '%calculate%';

-- Step 3: Remove ALL triggers on buckets table
DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON buckets CASCADE;
DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON public.buckets CASCADE;

-- Step 4: Remove ALL functions that might be causing issues
DROP FUNCTION IF EXISTS calculate_total_amount() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_total_amount() CASCADE;
DROP FUNCTION IF EXISTS calculate_total_amount(record) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_total_amount(record) CASCADE;

-- Step 5: Verify they are gone
SELECT 'FINAL CHECK - TRIGGERS:' as status;
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'buckets';

SELECT 'FINAL CHECK - FUNCTIONS:' as status;
SELECT proname 
FROM pg_proc 
WHERE proname = 'calculate_total_amount';

-- Step 6: Test bucket table structure
SELECT 'BUCKETS TABLE STRUCTURE:' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'buckets' 
ORDER BY ordinal_position;

-- If you see any triggers or functions still listed above, 
-- you may need to run additional DROP commands for those specific names.
