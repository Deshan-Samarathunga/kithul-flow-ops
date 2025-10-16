-- Rename contact_person column to center_agent in collection_centers table
-- This aligns the database schema with the frontend terminology

-- First, add the new center_agent column
ALTER TABLE public.collection_centers 
ADD COLUMN center_agent character varying(100);

-- Copy data from contact_person to center_agent
UPDATE public.collection_centers 
SET center_agent = contact_person;

-- Drop the old contact_person column
ALTER TABLE public.collection_centers 
DROP COLUMN contact_person;

-- Add a comment to document the change
COMMENT ON COLUMN public.collection_centers.center_agent IS 'The designated center agent responsible for this collection center';
