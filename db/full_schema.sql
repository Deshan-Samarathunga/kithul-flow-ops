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

ALTER TABLE IF EXISTS public.field_collection_drafts DROP COLUMN IF EXISTS product_type;

CREATE TABLE IF NOT EXISTS public.field_collection_drafts (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT field_collection_drafts_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.field_collection_drafts IS 'Field collection drafts shared across product lanes.';
COMMENT ON COLUMN public.field_collection_drafts.draft_id IS 'Human-readable draft reference used in the UI.';
COMMENT ON COLUMN public.field_collection_drafts.status IS 'Current workflow state (draft/submitted/completed).';
CREATE TABLE IF NOT EXISTS public.sap_cans (
  id BIGSERIAL PRIMARY KEY,
  can_id TEXT UNIQUE NOT NULL,
  draft_id BIGINT NOT NULL,
  collection_center_id BIGINT NOT NULL,
  product_type TEXT NOT NULL,
  brix_value NUMERIC(5,2),
  ph_value NUMERIC(3,2),
  quantity NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_cans_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.field_collection_drafts (id)
    ON DELETE CASCADE,
  CONSTRAINT sap_cans_center_fk
    FOREIGN KEY (collection_center_id)
    REFERENCES public.collection_centers (id)
    ON DELETE RESTRICT,
  CONSTRAINT sap_cans_product_ck
    CHECK (LOWER(product_type) = 'sap')
);

CREATE TABLE IF NOT EXISTS public.treacle_cans (
  id BIGSERIAL PRIMARY KEY,
  can_id TEXT UNIQUE NOT NULL,
  draft_id BIGINT NOT NULL,
  collection_center_id BIGINT NOT NULL,
  product_type TEXT NOT NULL,
  brix_value NUMERIC(5,2),
  ph_value NUMERIC(3,2),
  quantity NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_cans_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.field_collection_drafts (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_cans_center_fk
    FOREIGN KEY (collection_center_id)
    REFERENCES public.collection_centers (id)
    ON DELETE RESTRICT,
  CONSTRAINT treacle_cans_product_ck
    CHECK (LOWER(product_type) = 'treacle')
);

CREATE INDEX IF NOT EXISTS idx_sap_cans_draft_id ON public.sap_cans (draft_id);
CREATE INDEX IF NOT EXISTS idx_sap_cans_center_id ON public.sap_cans (collection_center_id);
CREATE INDEX IF NOT EXISTS idx_treacle_cans_draft_id ON public.treacle_cans (draft_id);
CREATE INDEX IF NOT EXISTS idx_treacle_cans_center_id ON public.treacle_cans (collection_center_id);

COMMENT ON TABLE public.sap_cans IS 'Individual SAP cans collected from field centers.';
COMMENT ON TABLE public.treacle_cans IS 'Individual Treacle cans collected from field centers.';

CREATE TABLE IF NOT EXISTS public.field_collection_center_completions (
  id BIGSERIAL PRIMARY KEY,
  draft_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT field_collection_center_completions_draft_fk
    FOREIGN KEY (draft_id)
    REFERENCES public.field_collection_drafts (draft_id)
    ON DELETE CASCADE,
  CONSTRAINT field_collection_center_completions_center_fk
    FOREIGN KEY (center_id)
    REFERENCES public.collection_centers (center_id)
    ON DELETE CASCADE,
  CONSTRAINT field_collection_center_completions_unique UNIQUE (draft_id, center_id)
);

CREATE INDEX IF NOT EXISTS idx_field_collection_center_completions_draft_center
  ON public.field_collection_center_completions (draft_id, center_id);
COMMENT ON TABLE public.field_collection_center_completions IS 'Completion tracking for field collection centers across products.';

------------------------------------------------------------------------
-- Processing (batches and can assignments)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sap_processing_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,
  batch_number TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'treacle',
  status TEXT NOT NULL DEFAULT 'in-progress',
  total_sap_output NUMERIC(12,2),
  used_gas_kg NUMERIC(12,2),
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
    CHECK (LOWER(product_type) = 'treacle')
);

CREATE TABLE IF NOT EXISTS public.jaggery_processing_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,
  batch_number TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'jaggery',
  status TEXT NOT NULL DEFAULT 'in-progress',
  total_sap_output NUMERIC(12,2),
  used_gas_kg NUMERIC(12,2),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jaggery_processing_batches_created_by_fk
    FOREIGN KEY (created_by)
    REFERENCES public.users (user_id)
    ON DELETE RESTRICT,
  CONSTRAINT jaggery_processing_batches_status_ck
    CHECK (status IN ('draft', 'in-progress', 'completed', 'cancelled')),
  CONSTRAINT jaggery_processing_batches_product_ck
    CHECK (LOWER(product_type) = 'jaggery')
);

CREATE INDEX IF NOT EXISTS idx_sap_processing_batches_status
  ON public.sap_processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_sap_processing_batches_sched
  ON public.sap_processing_batches (scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batches_status
  ON public.jaggery_processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batches_sched
  ON public.jaggery_processing_batches (scheduled_date DESC);

COMMENT ON TABLE public.sap_processing_batches IS 'Processing stage batches that convert SAP to Treacle (in-house made, supports up to fifteen cans).';
COMMENT ON TABLE public.jaggery_processing_batches IS 'Processing stage batches that convert Treacle (third-party) to Jaggery (supports up to fifteen cans).';

CREATE TABLE IF NOT EXISTS public.sap_processing_batch_cans (
  id BIGSERIAL PRIMARY KEY,
  processing_batch_id BIGINT NOT NULL,
  can_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sap_processing_batch_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.sap_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT sap_processing_can_fk
    FOREIGN KEY (can_id)
    REFERENCES public.sap_cans (id)
    ON DELETE RESTRICT,
  CONSTRAINT sap_processing_batch_can_uq UNIQUE (processing_batch_id, can_id),
  CONSTRAINT sap_processing_can_uq UNIQUE (can_id)
);

CREATE TABLE IF NOT EXISTS public.jaggery_processing_batch_cans (
  id BIGSERIAL PRIMARY KEY,
  processing_batch_id BIGINT NOT NULL,
  can_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jaggery_processing_batch_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.jaggery_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT jaggery_processing_can_fk
    FOREIGN KEY (can_id)
    REFERENCES public.treacle_cans (id)
    ON DELETE RESTRICT,
  CONSTRAINT jaggery_processing_batch_can_uq UNIQUE (processing_batch_id, can_id),
  CONSTRAINT jaggery_processing_can_uq UNIQUE (can_id)
);

CREATE INDEX IF NOT EXISTS idx_sap_processing_batch_cans_batch_id
  ON public.sap_processing_batch_cans (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_sap_processing_batch_cans_can_id
  ON public.sap_processing_batch_cans (can_id);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batch_cans_batch_id
  ON public.jaggery_processing_batch_cans (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batch_cans_can_id
  ON public.jaggery_processing_batch_cans (can_id);

COMMENT ON TABLE public.sap_processing_batch_cans IS 'SAP can assignments for processing batches that produce Treacle (in-house, limit fifteen).';
COMMENT ON TABLE public.jaggery_processing_batch_cans IS 'Treacle (third-party) can assignments for processing batches that produce Jaggery (limit fifteen).';

DROP TRIGGER IF EXISTS trg_sap_processing_can_limit ON public.sap_processing_batch_cans;
DROP TRIGGER IF EXISTS trg_treacle_processing_can_limit ON public.treacle_processing_batch_cans;
DROP TRIGGER IF EXISTS trg_jaggery_processing_can_limit ON public.jaggery_processing_batch_cans;
DROP FUNCTION IF EXISTS public.enforce_processing_can_limit_generic();

CREATE FUNCTION public.enforce_processing_can_limit_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  can_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.processing_batch_id <> OLD.processing_batch_id) THEN
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE processing_batch_id = $1', TG_TABLE_NAME)
    INTO can_count
    USING NEW.processing_batch_id;

    IF can_count >= 15 THEN
      RAISE EXCEPTION 'A processing batch cannot contain more than 15 cans.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sap_processing_can_limit
BEFORE INSERT OR UPDATE ON public.sap_processing_batch_cans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_can_limit_generic();

CREATE TRIGGER trg_jaggery_processing_can_limit
BEFORE INSERT OR UPDATE ON public.jaggery_processing_batch_cans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_can_limit_generic();

------------------------------------------------------------------------
-- Packaging (downstream workflow from processing)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.treacle_packaging_batches (
  id BIGSERIAL PRIMARY KEY,
  packaging_id TEXT UNIQUE NOT NULL,
  processing_batch_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  bottle_quantity NUMERIC(12,2),
  lid_quantity NUMERIC(12,2),
  alufoil_quantity NUMERIC(12,2),
  vacuum_bag_quantity NUMERIC(12,2),
  parchment_paper_quantity NUMERIC(12,2),
  finished_quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_packaging_processing_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.sap_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_packaging_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_treacle_packaging_batches_processing
  ON public.treacle_packaging_batches (processing_batch_id);

CREATE TABLE IF NOT EXISTS public.jaggery_packaging_batches (
  id BIGSERIAL PRIMARY KEY,
  packaging_id TEXT UNIQUE NOT NULL,
  processing_batch_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  bottle_quantity NUMERIC(12,2),
  lid_quantity NUMERIC(12,2),
  alufoil_quantity NUMERIC(12,2),
  vacuum_bag_quantity NUMERIC(12,2),
  parchment_paper_quantity NUMERIC(12,2),
  finished_quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jaggery_packaging_processing_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.jaggery_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT jaggery_packaging_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jaggery_packaging_batches_processing
  ON public.jaggery_packaging_batches (processing_batch_id);

COMMENT ON TABLE public.treacle_packaging_batches IS 'Packaging workflow for Treacle (in-house made from SAP).';
COMMENT ON TABLE public.jaggery_packaging_batches IS 'Packaging workflow for Jaggery (made from third-party Treacle).';

------------------------------------------------------------------------
-- Labeling (final workflow stage)
------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.treacle_labeling_batches (
  id BIGSERIAL PRIMARY KEY,
  labeling_id TEXT UNIQUE NOT NULL,
  packaging_batch_id BIGINT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  sticker_quantity NUMERIC(12,2),
  shrink_sleeve_quantity NUMERIC(12,2),
  neck_tag_quantity NUMERIC(12,2),
  corrugated_carton_quantity NUMERIC(12,2),
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

CREATE TABLE IF NOT EXISTS public.jaggery_labeling_batches (
  id BIGSERIAL PRIMARY KEY,
  labeling_id TEXT UNIQUE NOT NULL,
  packaging_batch_id BIGINT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  sticker_quantity NUMERIC(12,2),
  shrink_sleeve_quantity NUMERIC(12,2),
  neck_tag_quantity NUMERIC(12,2),
  corrugated_carton_quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jaggery_labeling_packaging_fk
    FOREIGN KEY (packaging_batch_id)
    REFERENCES public.jaggery_packaging_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT jaggery_labeling_status_ck
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE INDEX IF NOT EXISTS idx_jaggery_labeling_batches_packaging
  ON public.jaggery_labeling_batches (packaging_batch_id);

COMMENT ON TABLE public.treacle_labeling_batches IS 'Labeling data captured for Treacle (in-house) packaging runs.';
COMMENT ON TABLE public.jaggery_labeling_batches IS 'Labeling data captured for Jaggery packaging runs.';

------------------------------------------------------------------------
-- End of schema
------------------------------------------------------------------------

-- Executing this script provides a fresh database that matches the
-- expectations of the current Express API and client application.