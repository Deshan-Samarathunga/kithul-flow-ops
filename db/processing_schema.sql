-- Processing module schema
-- Batch tracking and bucket assignment tables per product lane.

CREATE TABLE IF NOT EXISTS public.sap_processing_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT UNIQUE NOT NULL,
  batch_number TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'sap',
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
    CHECK (LOWER(product_type) = 'sap')
);

CREATE TABLE IF NOT EXISTS public.treacle_processing_batches (
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

    IF bucket_count >= 15 THEN
      RAISE EXCEPTION 'A processing batch cannot contain more than 15 buckets.';
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
