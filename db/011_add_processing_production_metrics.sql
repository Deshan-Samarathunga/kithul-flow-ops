-- Adds production metrics to processing batches
ALTER TABLE public.processing_batches
    ADD COLUMN IF NOT EXISTS total_sap_output NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS gas_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(12,2);

COMMENT ON COLUMN public.processing_batches.total_sap_output IS 'Total sap output (kg) recorded after melting for the batch';
COMMENT ON COLUMN public.processing_batches.gas_cost IS 'Gas cost incurred during processing for the batch';
COMMENT ON COLUMN public.processing_batches.labor_cost IS 'Labor cost incurred during processing for the batch';
