-- Field Collection module schema
-- Draft, bucket, and center completion tables split per product lane.

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
