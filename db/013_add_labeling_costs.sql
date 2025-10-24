CREATE TABLE IF NOT EXISTS public.labeling_batches (
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
  CONSTRAINT fk_labeling_packaging
    FOREIGN KEY (packaging_batch_id)
    REFERENCES public.packaging_batches(id)
    ON DELETE CASCADE,
  CONSTRAINT labeling_status_check
    CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
);

CREATE INDEX IF NOT EXISTS idx_labeling_batches_packaging_id
  ON public.labeling_batches (packaging_batch_id);

COMMENT ON TABLE public.labeling_batches IS 'Tracks labeling-stage data for packaged batches.';
COMMENT ON COLUMN public.labeling_batches.labeling_id IS 'Business identifier for the labeling batch.';
COMMENT ON COLUMN public.labeling_batches.packaging_batch_id IS 'Reference to the packaging batch entering labeling.';
COMMENT ON COLUMN public.labeling_batches.sticker_cost IS 'Labeling sticker cost captured during labeling stage.';
COMMENT ON COLUMN public.labeling_batches.shrink_sleeve_cost IS 'Labeling shrink sleeve cost for sap production.';
COMMENT ON COLUMN public.labeling_batches.neck_tag_cost IS 'Labeling neck tag cost for sap production.';
COMMENT ON COLUMN public.labeling_batches.corrugated_carton_cost IS 'Labeling corrugated carton cost for sap and treacle production.';
