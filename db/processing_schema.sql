-- Processing module schema
-- Batch tracking and can assignment tables per product lane.

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

CREATE INDEX IF NOT EXISTS idx_treacle_processing_batches_status
  ON public.treacle_processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_treacle_processing_batches_sched
  ON public.treacle_processing_batches (scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batches_status
  ON public.jaggery_processing_batches (status);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batches_sched
  ON public.jaggery_processing_batches (scheduled_date DESC);

CREATE TABLE IF NOT EXISTS public.treacle_processing_batch_cans (
  id BIGSERIAL PRIMARY KEY,
  processing_batch_id BIGINT NOT NULL,
  can_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT treacle_processing_batch_fk
    FOREIGN KEY (processing_batch_id)
    REFERENCES public.treacle_processing_batches (id)
    ON DELETE CASCADE,
  CONSTRAINT treacle_processing_can_fk
    FOREIGN KEY (can_id)
    REFERENCES public.sap_cans (id)
    ON DELETE RESTRICT,
  CONSTRAINT treacle_processing_batch_can_uq UNIQUE (processing_batch_id, can_id),
  CONSTRAINT treacle_processing_can_uq UNIQUE (can_id)
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

CREATE INDEX IF NOT EXISTS idx_treacle_processing_batch_cans_batch_id
  ON public.treacle_processing_batch_cans (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_treacle_processing_batch_cans_can_id
  ON public.treacle_processing_batch_cans (can_id);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batch_cans_batch_id
  ON public.jaggery_processing_batch_cans (processing_batch_id);
CREATE INDEX IF NOT EXISTS idx_jaggery_processing_batch_cans_can_id
  ON public.jaggery_processing_batch_cans (can_id);

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

CREATE TRIGGER trg_treacle_processing_can_limit
BEFORE INSERT OR UPDATE ON public.treacle_processing_batch_cans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_can_limit_generic();

CREATE TRIGGER trg_jaggery_processing_can_limit
BEFORE INSERT OR UPDATE ON public.jaggery_processing_batch_cans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_can_limit_generic();
