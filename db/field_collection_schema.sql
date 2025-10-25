-- Field Collection module schema
-- Shared draft table with product-specific bucket/center tables.

DROP TABLE IF EXISTS public.sap_drafts CASCADE;
DROP TABLE IF EXISTS public.treacle_drafts CASCADE;
DROP TABLE IF EXISTS public.sap_center_completions CASCADE;
DROP TABLE IF EXISTS public.treacle_center_completions CASCADE;
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
    REFERENCES public.field_collection_drafts (id)
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
    REFERENCES public.field_collection_drafts (id)
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
