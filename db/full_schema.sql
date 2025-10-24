-- Kithul Flow Ops complete PostgreSQL schema
-- Execute this file on a clean database to provision every table, index,
-- constraint, and trigger used across all application modules.

------------------------------------------------------------------------
-- Core reference tables shared by every module
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  profile_image TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);

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

COMMENT ON TABLE public.users IS 'User accounts for the Kithul Flow Ops system.';
COMMENT ON TABLE public.collection_centers IS 'Collection centers where kithul products are gathered.';

------------------------------------------------------------------------
-- Optional seed data for reference tables
------------------------------------------------------------------------

INSERT INTO public.collection_centers (center_id, center_name, location, center_agent, contact_phone)
VALUES
  ('center001', 'Galle Collection Center', 'Galle', 'John Silva', '+94 77 123 4567'),
  ('center002', 'Kurunegala Collection Center', 'Kurunegala', 'Mary Perera', '+94 77 234 5678'),
  ('center003', 'Hikkaduwa Collection Center', 'Hikkaduwa', 'David Fernando', '+94 77 345 6789'),
  ('center004', 'Matara Collection Center', 'Matara', 'Sarah Jayawardena', '+94 77 456 7890')
ON CONFLICT (center_id) DO NOTHING;

------------------------------------------------------------------------
-- Field collection (drafts, buckets, center completion tracking)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sap_drafts (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'sap',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_drafts_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT sap_drafts_product_ck
    CHECK (LOWER(product_type) = 'sap')
);

CREATE TABLE IF NOT EXISTS public.treacle_drafts (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'treacle',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_drafts_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT treacle_drafts_product_ck
    CHECK (LOWER(product_type) = 'treacle')
);

COMMENT ON TABLE public.sap_drafts IS 'Field collection drafts for SAP product.';
COMMENT ON TABLE public.treacle_drafts IS 'Field collection drafts for Treacle product.';

CREATE TABLE IF NOT EXISTS public.sap_buckets (
  id BIGSERIAL PRIMARY KEY,
  bucket_id TEXT UNIQUE NOT NULL,
  draft_id BIGINT NOT NULL,
  collection_center_id BIGINT NOT NULL,
  product_type TEXT NOT NULL,
  brix_value NUMERIC(5,2),
  ph_value NUMERIC(3,2),
  quantity NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_buckets_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.sap_drafts (id)
    ON DELETE CASCADE,
  CONSTRAINT sap_buckets_center_fk
    FOREIGN KEY (collection_center_id)
    REFERENCES public.collection_centers (id)
    ON DELETE RESTRICT,
  CONSTRAINT sap_buckets_product_ck
    CHECK (LOWER(product_type) = 'sap')
);

CREATE TABLE IF NOT EXISTS public.treacle_buckets (
  id BIGSERIAL PRIMARY KEY,
  bucket_id TEXT UNIQUE NOT NULL,
  draft_id BIGINT NOT NULL,
  collection_center_id BIGINT NOT NULL,
  product_type TEXT NOT NULL,
  brix_value NUMERIC(5,2),
  ph_value NUMERIC(3,2),
  quantity NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_buckets_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.treacle_drafts (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_buckets_center_fk
    FOREIGN KEY (collection_center_id)
    REFERENCES public.collection_centers (id)
    ON DELETE RESTRICT,
  CONSTRAINT treacle_buckets_product_ck
    CHECK (LOWER(product_type) = 'treacle')
);

CREATE INDEX IF NOT EXISTS idx_sap_buckets_draft_id ON public.sap_buckets (draft_id);
CREATE INDEX IF NOT EXISTS idx_sap_buckets_center_id ON public.sap_buckets (collection_center_id);
CREATE INDEX IF NOT EXISTS idx_treacle_buckets_draft_id ON public.treacle_buckets (draft_id);
CREATE INDEX IF NOT EXISTS idx_treacle_buckets_center_id ON public.treacle_buckets (collection_center_id);

COMMENT ON TABLE public.sap_buckets IS 'Individual SAP buckets collected from field centers.';
COMMENT ON TABLE public.treacle_buckets IS 'Individual Treacle buckets collected from field centers.';

CREATE TABLE IF NOT EXISTS public.sap_center_completions (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sap_center_completions_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.sap_drafts (draft_id)
    ON DELETE CASCADE,
  CONSTRAINT sap_center_completions_center_fk
    FOREIGN KEY (center_id)
    REFERENCES public.collection_centers (center_id)
    ON DELETE CASCADE,
  CONSTRAINT sap_center_completions_unique UNIQUE (draft_id, center_id)
);

CREATE TABLE IF NOT EXISTS public.treacle_center_completions (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT treacle_center_completions_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.treacle_drafts (draft_id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_center_completions_center_fk
    FOREIGN KEY (center_id)
    REFERENCES public.collection_centers (center_id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_center_completions_unique UNIQUE (draft_id, center_id)
);

CREATE INDEX IF NOT EXISTS idx_sap_center_completions_draft_center
  ON public.sap_center_completions (draft_id, center_id);
CREATE INDEX IF NOT EXISTS idx_treacle_center_completions_draft_center
  ON public.treacle_center_completions (draft_id, center_id);

COMMENT ON TABLE public.sap_center_completions IS 'Completion tracking for SAP field collection centers.';
COMMENT ON TABLE public.treacle_center_completions IS 'Completion tracking for Treacle field collection centers.';

------------------------------------------------------------------------
-- Processing (batches and bucket assignments)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sap_processing_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,
  batch_number TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'sap',
  status TEXT NOT NULL DEFAULT 'in-progress',
  notes TEXT,
  total_sap_output NUMERIC(12,2),
  gas_cost NUMERIC(12,2),
  labor_cost NUMERIC(12,2),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_processing_batches_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT sap_processing_batches_status_ck
    CHECK (status IN ('draft', 'in-progress', 'completed', 'cancelled')),
  CONSTRAINT sap_processing_batches_product_ck
    CHECK (LOWER(product_type) = 'sap')
);

CREATE TABLE IF NOT EXISTS public.treacle_processing_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,
  batch_number TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'treacle',
  status TEXT NOT NULL DEFAULT 'in-progress',
  notes TEXT,
  total_sap_output NUMERIC(12,2),
  gas_cost NUMERIC(12,2),
  labor_cost NUMERIC(12,2),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_processing_batches_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT treacle_processing_batches_status_ck
    CHECK (status IN ('draft', 'in-progress', 'completed', 'cancelled')),
  CONSTRAINT treacle_processing_batches_product_ck
    CHECK (LOWER(product_type) = 'treacle')
);

CREATE INDEX IF NOT EXISTS idx_sap_processing_batches_status
  ON public.sap_processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_sap_processing_batches_sched
  ON public.sap_processing_batches (scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_treacle_processing_batches_status
  ON public.treacle_processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_treacle_processing_batches_sched
  ON public.treacle_processing_batches (scheduled_date DESC);

COMMENT ON TABLE public.sap_processing_batches IS 'Processing stage batches for SAP (max four buckets).';
COMMENT ON TABLE public.treacle_processing_batches IS 'Processing stage batches for Treacle (max four buckets).';

CREATE TABLE IF NOT EXISTS public.sap_processing_batch_buckets (
  id BIGSERIAL PRIMARY KEY,
  processing_batch_id BIGINT NOT NULL,
  bucket_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_processing_batch_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.sap_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT sap_processing_bucket_fk
    FOREIGN KEY (bucket_id)
    REFERENCES public.sap_buckets (id)
    ON DELETE RESTRICT,
  CONSTRAINT sap_processing_batch_bucket_uq UNIQUE (processing_batch_id, bucket_id),
  CONSTRAINT sap_processing_bucket_uq UNIQUE (bucket_id)
);

CREATE TABLE IF NOT EXISTS public.treacle_processing_batch_buckets (
  id BIGSERIAL PRIMARY KEY,
  processing_batch_id BIGINT NOT NULL,
  bucket_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_processing_batch_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.treacle_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_processing_bucket_fk
    FOREIGN KEY (bucket_id)
    REFERENCES public.treacle_buckets (id)
    ON DELETE RESTRICT,
  CONSTRAINT treacle_processing_batch_bucket_uq UNIQUE (processing_batch_id, bucket_id),
  CONSTRAINT treacle_processing_bucket_uq UNIQUE (bucket_id)
);

CREATE INDEX IF NOT EXISTS idx_sap_processing_batch_buckets_batch_id
  ON public.sap_processing_batch_buckets (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_sap_processing_batch_buckets_bucket_id
  ON public.sap_processing_batch_buckets (bucket_id);
CREATE INDEX IF NOT EXISTS idx_treacle_processing_batch_buckets_batch_id
  ON public.treacle_processing_batch_buckets (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_treacle_processing_batch_buckets_bucket_id
  ON public.treacle_processing_batch_buckets (bucket_id);

COMMENT ON TABLE public.sap_processing_batch_buckets IS 'SAP bucket assignments for processing batches (limit four).';
COMMENT ON TABLE public.treacle_processing_batch_buckets IS 'Treacle bucket assignments for processing batches (limit four).';

DROP TRIGGER IF EXISTS trg_sap_processing_bucket_limit ON public.sap_processing_batch_buckets;
DROP TRIGGER IF EXISTS trg_treacle_processing_bucket_limit ON public.treacle_processing_batch_buckets;
DROP FUNCTION IF EXISTS public.enforce_processing_bucket_limit_generic();

CREATE FUNCTION public.enforce_processing_bucket_limit_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bucket_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.processing_batch_id <> OLD.processing_batch_id) THEN
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE processing_batch_id = $1', TG_TABLE_NAME)
    INTO bucket_count
    USING NEW.processing_batch_id;

    IF bucket_count >= 4 THEN
      RAISE EXCEPTION 'A processing batch cannot contain more than 4 buckets.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sap_processing_bucket_limit
BEFORE INSERT OR UPDATE ON public.sap_processing_batch_buckets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_bucket_limit_generic();

CREATE TRIGGER trg_treacle_processing_bucket_limit
BEFORE INSERT OR UPDATE ON public.treacle_processing_batch_buckets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_bucket_limit_generic();

------------------------------------------------------------------------
-- Packaging (downstream workflow from processing)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sap_packaging_batches (
  id BIGSERIAL PRIMARY KEY,
  packaging_id TEXT UNIQUE NOT NULL,
  processing_batch_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  bottle_cost NUMERIC(12,2),
  lid_cost NUMERIC(12,2),
  alufoil_cost NUMERIC(12,2),
  vacuum_bag_cost NUMERIC(12,2),
  parchment_paper_cost NUMERIC(12,2),
  finished_quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_packaging_processing_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.sap_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT sap_packaging_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sap_packaging_batches_processing
  ON public.sap_packaging_batches (processing_batch_id);

CREATE TABLE IF NOT EXISTS public.treacle_packaging_batches (
  id BIGSERIAL PRIMARY KEY,
  packaging_id TEXT UNIQUE NOT NULL,
  processing_batch_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  bottle_cost NUMERIC(12,2),
  lid_cost NUMERIC(12,2),
  alufoil_cost NUMERIC(12,2),
  vacuum_bag_cost NUMERIC(12,2),
  parchment_paper_cost NUMERIC(12,2),
  finished_quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_packaging_processing_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.treacle_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_packaging_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_treacle_packaging_batches_processing
  ON public.treacle_packaging_batches (processing_batch_id);

COMMENT ON TABLE public.sap_packaging_batches IS 'Packaging workflow for SAP production.';
COMMENT ON TABLE public.treacle_packaging_batches IS 'Packaging workflow for Treacle production.';

------------------------------------------------------------------------
-- Labeling (final workflow stage)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sap_labeling_batches (
  id BIGSERIAL PRIMARY KEY,
  labeling_id TEXT UNIQUE NOT NULL,
  packaging_batch_id BIGINT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  sticker_cost NUMERIC(12,2),
  shrink_sleeve_cost NUMERIC(12,2),
  neck_tag_cost NUMERIC(12,2),
  corrugated_carton_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_labeling_packaging_fk
    FOREIGN KEY (packaging_batch_id)
    REFERENCES public.sap_packaging_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT sap_labeling_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE INDEX IF NOT EXISTS idx_sap_labeling_batches_packaging
  ON public.sap_labeling_batches (packaging_batch_id);

CREATE TABLE IF NOT EXISTS public.treacle_labeling_batches (
  id BIGSERIAL PRIMARY KEY,
  labeling_id TEXT UNIQUE NOT NULL,
  packaging_batch_id BIGINT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  sticker_cost NUMERIC(12,2),
  shrink_sleeve_cost NUMERIC(12,2),
  neck_tag_cost NUMERIC(12,2),
  corrugated_carton_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_labeling_packaging_fk
    FOREIGN KEY (packaging_batch_id)
    REFERENCES public.treacle_packaging_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_labeling_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE INDEX IF NOT EXISTS idx_treacle_labeling_batches_packaging
  ON public.treacle_labeling_batches (packaging_batch_id);

COMMENT ON TABLE public.sap_labeling_batches IS 'Labeling data captured for SAP packaging runs.';
COMMENT ON TABLE public.treacle_labeling_batches IS 'Labeling data captured for Treacle packaging runs.';

------------------------------------------------------------------------
-- End of schema
------------------------------------------------------------------------

-- Executing this script provides a fresh database that matches the
-- expectations of the current Express API and client application.
