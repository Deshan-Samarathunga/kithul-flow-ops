-- Remove unused columns from buckets table
-- These columns (qr_code, farmer_id, farmer_name, collection_time) are not being used
-- and contain only null values

-- Drop the unused columns
ALTER TABLE public.buckets DROP COLUMN IF EXISTS qr_code;
ALTER TABLE public.buckets DROP COLUMN IF EXISTS farmer_id;
ALTER TABLE public.buckets DROP COLUMN IF EXISTS farmer_name;
ALTER TABLE public.buckets DROP COLUMN IF EXISTS collection_time;

-- Add comment to document the change
COMMENT ON TABLE public.buckets IS 'Buckets table - simplified to only include essential fields';
