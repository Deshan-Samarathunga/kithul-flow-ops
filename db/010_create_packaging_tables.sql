-- Packaging workflow tables for batches leaving processing
CREATE TABLE IF NOT EXISTS public.packaging_batches (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_packaging_processing_batch
    FOREIGN KEY (processing_batch_id)
    REFERENCES processing_batches(id)
    ON DELETE CASCADE,
  CONSTRAINT packaging_status_check
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_batches_processing_batch
  ON public.packaging_batches (processing_batch_id);

COMMENT ON TABLE public.packaging_batches IS 'Tracks processing batches that have moved into the packaging workflow.';
