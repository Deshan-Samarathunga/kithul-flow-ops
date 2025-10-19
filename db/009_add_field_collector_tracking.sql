-- Add field collector tracking to buckets table
-- This migration adds a field_collector_id column to track which field collector collected each bucket

-- Add the field_collector_id column to buckets table (only if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'buckets' 
        AND column_name = 'field_collector_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.buckets ADD COLUMN field_collector_id TEXT;
    END IF;
END $$;

-- Add foreign key constraint to reference users table (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_field_collector' 
        AND table_name = 'buckets'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.buckets 
        ADD CONSTRAINT fk_field_collector 
        FOREIGN KEY (field_collector_id) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_buckets_field_collector_id ON buckets (field_collector_id);

-- Add comment
COMMENT ON COLUMN public.buckets.field_collector_id IS 'User ID of the field collector who collected this bucket';

-- Update existing buckets to have a default field collector if any exist
-- This is optional and can be customized based on your needs
UPDATE public.buckets 
SET field_collector_id = 'field01' 
WHERE field_collector_id IS NULL 
AND EXISTS (SELECT 1 FROM users WHERE user_id = 'field01' AND role = 'Field Collection');
