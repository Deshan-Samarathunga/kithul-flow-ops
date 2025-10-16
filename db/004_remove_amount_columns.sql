-- Remove amount_per_liter and total_amount columns from buckets table
-- These columns are not needed in the simplified bucket structure

-- Drop the amount columns
ALTER TABLE public.buckets DROP COLUMN IF EXISTS amount_per_liter;
ALTER TABLE public.buckets DROP COLUMN IF EXISTS total_amount;

-- Add comment to document the change
COMMENT ON TABLE public.buckets IS 'Buckets table - simplified structure with only essential measurement fields';
