-- Labeling module schema
-- Final-stage labeling tables scoped per product lane.

CREATE TABLE IF NOT EXISTS public.sap_labeling_batches (
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
