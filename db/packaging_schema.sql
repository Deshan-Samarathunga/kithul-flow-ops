-- Packaging module schema
-- Packaging batch tables scoped per product lane.

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
