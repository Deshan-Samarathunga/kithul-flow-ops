-- Sample data for local development and manual testing
-- ---------------------------------------------------------------------------

-- Users
INSERT INTO public.users (user_id, password_hash, name, role)
VALUES
  ('admin01', '$2b$10$examplehashadmin01', 'Admin User', 'Administrator'),
  ('field01', '$2b$10$examplehashfield01', 'Field Collector One', 'Field Collection')
ON CONFLICT (user_id) DO NOTHING;

-- Collection centers
INSERT INTO public.collection_centers (center_id, center_name, location, center_agent, contact_phone)
VALUES
  ('center001', 'Dambuluwana', 'Kegalle', 'Agent One', '+94 71 000 0001'),
  ('center002', 'Pitakanda', 'Kurunegala', 'Agent Two', '+94 77 000 0002'),
  ('center003', 'Yatiyanthota', 'Kegalle', 'Agent Three', '+94 77 000 0003'),
  ('center004', 'Warakapola', 'Kegalle', 'Agent Four', '+94 71 000 0004')
ON CONFLICT (center_id) DO NOTHING;

-- Seed a handful of drafts
INSERT INTO public.field_collection_drafts (draft_id, date, status, created_by)
VALUES
  ('sap-2025-09-01', '2025-09-01', 'draft', 'field01'),
  ('sap-2025-08-28', '2025-08-28', 'submitted', 'field01'),
  ('treacle-2025-09-02', '2025-09-02', 'draft', 'field01'),
  ('treacle-2025-08-27', '2025-08-27', 'submitted', 'field01')
ON CONFLICT (draft_id) DO NOTHING;

-- Synthetic draft batches to back the bucket samples
INSERT INTO public.field_collection_drafts (draft_id, date, status, created_by)
SELECT
  'sap-sample-' || LPAD(series.seq::text, 3, '0'),
  DATE '2025-07-01' + (series.seq - 1),
  CASE
    WHEN series.seq % 3 = 0 THEN 'completed'
    WHEN series.seq % 3 = 1 THEN 'draft'
    ELSE 'submitted'
  END,
  'field01'
FROM generate_series(1, 20) AS series(seq)
ON CONFLICT (draft_id) DO NOTHING;

INSERT INTO public.field_collection_drafts (draft_id, date, status, created_by)
SELECT
  'treacle-sample-' || LPAD(series.seq::text, 3, '0'),
  DATE '2025-07-15' + (series.seq - 1),
  CASE
    WHEN series.seq % 3 = 0 THEN 'completed'
    WHEN series.seq % 3 = 1 THEN 'draft'
    ELSE 'submitted'
  END,
  'field01'
FROM generate_series(1, 20) AS series(seq)
ON CONFLICT (draft_id) DO NOTHING;

-- A few deterministic buckets for headline drafts
INSERT INTO public.sap_buckets (bucket_id, draft_id, collection_center_id, product_type, brix_value, ph_value, quantity)
SELECT bucket.bucket_id,
     draft.id,
     center.id,
     'sap',
     bucket.brix_value,
     bucket.ph_value,
     bucket.quantity
FROM (VALUES
  ('SAP-BKT-001', 'sap-2025-09-01', 'center001', 64.50, 6.10, 120.00),
  ('SAP-BKT-002', 'sap-2025-09-01', 'center002', 63.20, 6.05, 98.75),
  ('SAP-BKT-003', 'sap-2025-08-28', 'center003', 65.80, 6.20, 110.30)
) AS bucket(bucket_id, draft_ref, center_ref, brix_value, ph_value, quantity)
JOIN public.field_collection_drafts draft ON draft.draft_id = bucket.draft_ref
JOIN public.collection_centers center ON center.center_id = bucket.center_ref
ON CONFLICT (bucket_id) DO NOTHING;

INSERT INTO public.treacle_buckets (bucket_id, draft_id, collection_center_id, product_type, brix_value, ph_value, quantity)
SELECT bucket.bucket_id,
     draft.id,
     center.id,
     'treacle',
     bucket.brix_value,
     bucket.ph_value,
     bucket.quantity
FROM (VALUES
  ('TRC-BKT-001', 'treacle-2025-09-02', 'center002', 72.10, 5.80, 140.50),
  ('TRC-BKT-002', 'treacle-2025-09-02', 'center003', 70.90, 5.75, 132.25),
  ('TRC-BKT-003', 'treacle-2025-08-27', 'center004', 71.50, 5.85, 128.40)
) AS bucket(bucket_id, draft_ref, center_ref, brix_value, ph_value, quantity)
JOIN public.field_collection_drafts draft ON draft.draft_id = bucket.draft_ref
JOIN public.collection_centers center ON center.center_id = bucket.center_ref
ON CONFLICT (bucket_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 200 SAP buckets (3 fixed above + 197 synthetic)
-- ---------------------------------------------------------------------------
WITH all_centers AS (
  SELECT array_agg(id ORDER BY center_id) AS ids FROM public.collection_centers
),
numbered_drafts AS (
  SELECT id, draft_id, ROW_NUMBER() OVER (ORDER BY draft_id) AS rn
  FROM public.field_collection_drafts
  WHERE draft_id LIKE 'sap-sample-%'
  ORDER BY draft_id
),
sap_draft_meta AS (
  SELECT GREATEST(COUNT(*), 1) AS draft_count FROM numbered_drafts
),
sap_sequence AS (
  SELECT
    g AS seq,
    ((g - 1) % GREATEST(array_length(all_centers.ids, 1), 1)) + 1 AS center_idx,
    ((g - 1) % sap_draft_meta.draft_count) + 1 AS draft_idx
  FROM generate_series(1, 197) AS g
  CROSS JOIN all_centers
  CROSS JOIN sap_draft_meta
)
INSERT INTO public.sap_buckets (bucket_id, draft_id, collection_center_id, product_type, brix_value, ph_value, quantity)
SELECT
  'SAP-SMP-' || LPAD(sap_sequence.seq::text, 4, '0'),
  draft.id,
  centers.ids[sap_sequence.center_idx],
  'sap',
  ROUND((58 + random() * 10)::numeric, 2),
  ROUND((5.4 + random() * 0.6)::numeric, 2),
  ROUND((90 + random() * 70)::numeric, 2)
FROM sap_sequence
JOIN numbered_drafts draft ON draft.rn = sap_sequence.draft_idx
JOIN all_centers centers ON TRUE
WHERE centers.ids[sap_sequence.center_idx] IS NOT NULL
ON CONFLICT (bucket_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 200 Treacle buckets (3 fixed above + 197 synthetic)
-- ---------------------------------------------------------------------------
WITH all_centers AS (
  SELECT array_agg(id ORDER BY center_id) AS ids FROM public.collection_centers
),
numbered_drafts AS (
  SELECT id, draft_id, ROW_NUMBER() OVER (ORDER BY draft_id) AS rn
  FROM public.field_collection_drafts
  WHERE draft_id LIKE 'treacle-sample-%'
  ORDER BY draft_id
),
treacle_draft_meta AS (
  SELECT GREATEST(COUNT(*), 1) AS draft_count FROM numbered_drafts
),
treacle_sequence AS (
  SELECT
    g AS seq,
    ((g - 1) % GREATEST(array_length(all_centers.ids, 1), 1)) + 1 AS center_idx,
    ((g - 1) % treacle_draft_meta.draft_count) + 1 AS draft_idx
  FROM generate_series(1, 197) AS g
  CROSS JOIN all_centers
  CROSS JOIN treacle_draft_meta
)
INSERT INTO public.treacle_buckets (bucket_id, draft_id, collection_center_id, product_type, brix_value, ph_value, quantity)
SELECT
  'TRC-SMP-' || LPAD(treacle_sequence.seq::text, 4, '0'),
  draft.id,
  centers.ids[treacle_sequence.center_idx],
  'treacle',
  ROUND((68 + random() * 6)::numeric, 2),
  ROUND((5.6 + random() * 0.7)::numeric, 2),
  ROUND((120 + random() * 90)::numeric, 2)
FROM treacle_sequence
JOIN numbered_drafts draft ON draft.rn = treacle_sequence.draft_idx
JOIN all_centers centers ON TRUE
WHERE centers.ids[treacle_sequence.center_idx] IS NOT NULL
ON CONFLICT (bucket_id) DO NOTHING;

-- Field collection center completion samples
INSERT INTO public.field_collection_center_completions (draft_id, center_id, completed_at)
VALUES
  ('sap-2025-08-28', 'center003', NOW() - INTERVAL '5 days'),
  ('sap-2025-08-28', 'center004', NOW() - INTERVAL '4 days'),
  ('treacle-2025-08-27', 'center003', NOW() - INTERVAL '3 days'),
  ('treacle-2025-08-27', 'center004', NOW() - INTERVAL '2 days')
ON CONFLICT (draft_id, center_id) DO NOTHING;
