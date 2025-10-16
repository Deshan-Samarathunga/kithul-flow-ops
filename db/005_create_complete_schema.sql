-- Complete database schema for Kithul Flow Ops
-- This file creates all necessary tables with the current simplified structure

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile_image TEXT
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

-- Create collection_centers table
CREATE TABLE IF NOT EXISTS public.collection_centers (
  id BIGSERIAL PRIMARY KEY,
  center_id TEXT UNIQUE NOT NULL,
  center_name TEXT NOT NULL,
  location TEXT NOT NULL,
  center_agent TEXT NOT NULL,
  contact_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create drafts table
CREATE TABLE IF NOT EXISTS public.drafts (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'sap',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_created_by
    FOREIGN KEY(created_by) 
    REFERENCES users(user_id)
    ON DELETE RESTRICT
);

-- Create buckets table with simplified structure
CREATE TABLE IF NOT EXISTS public.buckets (
  id BIGSERIAL PRIMARY KEY,
  bucket_id TEXT UNIQUE NOT NULL,
  draft_id BIGINT NOT NULL,
  collection_center_id BIGINT NOT NULL,
  product_type TEXT NOT NULL,
  brix_value DECIMAL(5,2),
  ph_value DECIMAL(3,2),
  quantity DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_draft
    FOREIGN KEY(draft_id) 
    REFERENCES drafts(id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_collection_center
    FOREIGN KEY(collection_center_id) 
    REFERENCES collection_centers(id)
    ON DELETE RESTRICT
);

-- Create center_completions table
CREATE TABLE IF NOT EXISTS public.center_completions (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_draft_completion
    FOREIGN KEY(draft_id) 
    REFERENCES drafts(draft_id)
    ON DELETE CASCADE,
    
  CONSTRAINT fk_center_completion
    FOREIGN KEY(center_id) 
    REFERENCES collection_centers(center_id)
    ON DELETE CASCADE,
    
  CONSTRAINT unique_draft_center UNIQUE (draft_id, center_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_buckets_draft_id ON buckets (draft_id);
CREATE INDEX IF NOT EXISTS idx_buckets_collection_center_id ON buckets (collection_center_id);
CREATE INDEX IF NOT EXISTS idx_center_completions_draft_center ON center_completions (draft_id, center_id);

-- Insert default collection centers
INSERT INTO public.collection_centers (center_id, center_name, location, center_agent, contact_phone) VALUES
('center001', 'Galle Collection Center', 'Galle', 'John Silva', '+94 77 123 4567'),
('center002', 'Kurunegala Collection Center', 'Kurunegala', 'Mary Perera', '+94 77 234 5678'),
('center003', 'Hikkaduwa Collection Center', 'Hikkaduwa', 'David Fernando', '+94 77 345 6789'),
('center004', 'Matara Collection Center', 'Matara', 'Sarah Jayawardena', '+94 77 456 7890')
ON CONFLICT (center_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.users IS 'User accounts for the Kithul Flow Ops system';
COMMENT ON TABLE public.collection_centers IS 'Collection centers where kithul products are gathered';
COMMENT ON TABLE public.drafts IS 'Collection drafts for organizing field collection activities';
COMMENT ON TABLE public.buckets IS 'Individual kithul sap/treacle buckets collected from farmers';
COMMENT ON TABLE public.center_completions IS 'Tracks which collection centers have been marked as completed for a specific draft';
