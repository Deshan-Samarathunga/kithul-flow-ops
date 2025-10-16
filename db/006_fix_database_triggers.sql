-- Fix database triggers that are causing bucket creation to fail
-- This script removes the problematic trigger and function that reference deleted columns

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON buckets;

-- Drop the problematic function
DROP FUNCTION IF EXISTS calculate_total_amount();

-- Check for any remaining triggers on buckets table
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'buckets';

-- Verify buckets table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'buckets' 
ORDER BY ordinal_position;

-- Add comment to document the fix
COMMENT ON TABLE public.buckets IS 'Buckets table - triggers fixed, simplified structure with only essential measurement fields';
