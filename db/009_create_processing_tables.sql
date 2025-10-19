-- Processing workflow schema additions
-- Run this migration to enable processing batch storage

-- Processing batches master table
CREATE TABLE IF NOT EXISTS public.processing_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,
  batch_number TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'sap',
  status TEXT NOT NULL DEFAULT 'in-progress',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_processing_batches_created_by
    FOREIGN KEY(created_by)
    REFERENCES public.users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT processing_batches_status_check
    CHECK (status IN ('draft', 'in-progress', 'completed', 'cancelled')),
  CONSTRAINT processing_batches_product_check
    CHECK (product_type IN ('sap', 'treacle', 'toddy'))
);

CREATE INDEX IF NOT EXISTS idx_processing_batches_status ON public.processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_processing_batches_scheduled_date ON public.processing_batches (scheduled_date DESC);

COMMENT ON TABLE public.processing_batches IS 'Processing stage batches that group up to four collected buckets';

-- Join table between processing batches and buckets
CREATE TABLE IF NOT EXISTS public.processing_batch_buckets (
  id BIGSERIAL PRIMARY KEY,
  processing_batch_id BIGINT NOT NULL,
  bucket_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_processing_batch
    FOREIGN KEY(processing_batch_id)
    REFERENCES public.processing_batches(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_processing_bucket
    FOREIGN KEY(bucket_id)
    REFERENCES public.buckets(id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_processing_batch_bucket UNIQUE (processing_batch_id, bucket_id),
  CONSTRAINT uq_processing_bucket UNIQUE (bucket_id)
);

CREATE INDEX IF NOT EXISTS idx_processing_batch_buckets_batch_id ON public.processing_batch_buckets (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_batch_buckets_bucket_id ON public.processing_batch_buckets (bucket_id);

COMMENT ON TABLE public.processing_batch_buckets IS 'Assignments of field buckets to processing batches (max four per batch)';

-- Enforce the four-bucket limit at the database layer
DROP TRIGGER IF EXISTS trg_enforce_processing_bucket_limit ON public.processing_batch_buckets;
DROP FUNCTION IF EXISTS public.enforce_processing_bucket_limit();

CREATE FUNCTION public.enforce_processing_bucket_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  bucket_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO bucket_count
    FROM public.processing_batch_buckets
    WHERE processing_batch_id = NEW.processing_batch_id;

    IF bucket_count >= 4 THEN
      RAISE EXCEPTION 'A processing batch cannot contain more than 4 buckets.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.processing_batch_id <> OLD.processing_batch_id THEN
      SELECT COUNT(*) INTO bucket_count
      FROM public.processing_batch_buckets
      WHERE processing_batch_id = NEW.processing_batch_id;

      IF bucket_count >= 4 THEN
        RAISE EXCEPTION 'A processing batch cannot contain more than 4 buckets.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_processing_bucket_limit
BEFORE INSERT OR UPDATE ON public.processing_batch_buckets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_bucket_limit();
