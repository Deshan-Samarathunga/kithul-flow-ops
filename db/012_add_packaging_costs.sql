-- Adds packaging cost columns for sap and treacle workflows
ALTER TABLE public.packaging_batches
    ADD COLUMN IF NOT EXISTS bottle_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS lid_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS alufoil_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS vacuum_bag_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS parchment_paper_cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS finished_quantity NUMERIC(12,2);

COMMENT ON COLUMN public.packaging_batches.bottle_cost IS 'Cost of bottles used for sap packaging';
COMMENT ON COLUMN public.packaging_batches.lid_cost IS 'Cost of lids used for sap packaging';
COMMENT ON COLUMN public.packaging_batches.alufoil_cost IS 'Cost of alufoil used for treacle packaging';
COMMENT ON COLUMN public.packaging_batches.vacuum_bag_cost IS 'Cost of vacuum bags used for treacle packaging';
COMMENT ON COLUMN public.packaging_batches.parchment_paper_cost IS 'Cost of parchment paper used for treacle packaging';
COMMENT ON COLUMN public.packaging_batches.finished_quantity IS 'Quantity packaged after processing (liters for sap, kilograms for treacle).';
