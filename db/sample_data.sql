-- Sample data focused on the Field Collection module for local development.
-- Run after applying the schema migrations to populate drafts and cans
-- referenced by the Field Collection page only.
-- ---------------------------------------------------------------------------

-- Users
INSERT INTO public.users (user_id, password_hash, name, role)
VALUES
  ('admin01', '$2b$10$examplehashadmin01', 'Admin User', 'Administrator'),
  ('field01', '$2b$10$examplehashfield01', 'Field Collector One', 'Field Collection'),
  ('field02', '$2b$10$examplehashfield02', 'Field Collector Two', 'Field Collection')
ON CONFLICT (user_id) DO NOTHING;

-- Collection centers
INSERT INTO public.collection_centers (center_id, center_name, location, center_agent, contact_phone)
VALUES
  ('center001', 'Dambuluwana', 'Kegalle', 'Agent One', '+94 71 000 0001'),
  ('center002', 'Pitakanda', 'Kurunegala', 'Agent Two', '+94 77 000 0002'),
  ('center003', 'Yatiyanthota', 'Kegalle', 'Agent Three', '+94 77 000 0003'),
  ('center004', 'Warakapola', 'Kegalle', 'Agent Four', '+94 71 000 0004')
ON CONFLICT (center_id) DO NOTHING;

-- Seed a handful of drafts covering multiple statuses
INSERT INTO public.field_collection_drafts (draft_id, date, status, created_by)
VALUES
  ('sap-2025-09-01', '2025-09-01', 'draft', 'field01'),
  ('sap-2025-08-28', '2025-08-28', 'submitted', 'field01'),
  ('sap-2025-08-15', '2025-08-15', 'completed', 'field01'),
  ('treacle-2025-09-02', '2025-09-02', 'draft', 'field02'),
  ('treacle-2025-08-27', '2025-08-27', 'completed', 'field02')
ON CONFLICT (draft_id) DO NOTHING;

-- ---------- 50 SAP cans ----------
WITH sap_centers AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY center_id) AS rn
  FROM public.collection_centers
),
sap_drafts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY draft_id) AS rn
  FROM public.field_collection_drafts
  WHERE LOWER(draft_id) LIKE 'sap-%'
),
sap_meta AS (
  SELECT
    GREATEST((SELECT COUNT(*) FROM sap_drafts), 1) AS draft_count,
    GREATEST((SELECT COUNT(*) FROM sap_centers), 1) AS center_count
)
INSERT INTO public.sap_cans (
  can_id,
  draft_id,
  collection_center_id,
  product_type,
  brix_value,
  ph_value,
  quantity
)
SELECT
  'SAP-AUTO-' || LPAD(series.seq::text, 4, '0'),
  d.id,
  c.id,
  'sap',
  ROUND((58 + random() * 10)::numeric, 2),
  ROUND((5.4 + random() * 0.6)::numeric, 2),
  ROUND((90 + random() * 70)::numeric, 2)
FROM (
  SELECT
    g AS seq,
    ((g - 1) % (SELECT draft_count FROM sap_meta)) + 1 AS draft_idx,
    ((g - 1) % (SELECT center_count FROM sap_meta)) + 1 AS center_idx
  FROM generate_series(1, 50) AS g
) AS series
JOIN sap_drafts d ON d.rn = series.draft_idx
JOIN sap_centers c ON c.rn = series.center_idx
ON CONFLICT (can_id) DO NOTHING;

-- ---------- 50 Treacle cans ----------
WITH treacle_centers AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY center_id) AS rn
  FROM public.collection_centers
),
treacle_drafts AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY draft_id) AS rn
  FROM public.field_collection_drafts
  WHERE LOWER(draft_id) LIKE 'treacle-%'
),
treacle_meta AS (
  SELECT
    GREATEST((SELECT COUNT(*) FROM treacle_drafts), 1) AS draft_count,
    GREATEST((SELECT COUNT(*) FROM treacle_centers), 1) AS center_count
)
INSERT INTO public.treacle_cans (
  can_id,
  draft_id,
  collection_center_id,
  product_type,
  brix_value,
  ph_value,
  quantity
)
SELECT
  'TRC-AUTO-' || LPAD(series.seq::text, 4, '0'),
  d.id,
  c.id,
  'treacle',
  ROUND((68 + random() * 6)::numeric, 2),
  ROUND((5.6 + random() * 0.7)::numeric, 2),
  ROUND((120 + random() * 90)::numeric, 2)
FROM (
  SELECT
    g AS seq,
    ((g - 1) % (SELECT draft_count FROM treacle_meta)) + 1 AS draft_idx,
    ((g - 1) % (SELECT center_count FROM treacle_meta)) + 1 AS center_idx
  FROM generate_series(1, 50) AS g
) AS series
JOIN treacle_drafts d ON d.rn = series.draft_idx
JOIN treacle_centers c ON c.rn = series.center_idx
ON CONFLICT (can_id) DO NOTHING;

-- Deterministic center completion timestamps for UI examples
INSERT INTO public.field_collection_center_completions (draft_id, center_id, completed_at)
VALUES
  ('sap-2025-08-28', 'center003', TIMESTAMPTZ '2025-08-28 10:30:00+05:30'),
  ('sap-2025-08-28', 'center004', TIMESTAMPTZ '2025-08-28 14:15:00+05:30'),
  ('sap-2025-08-15', 'center001', TIMESTAMPTZ '2025-08-15 09:00:00+05:30'),
  ('treacle-2025-08-27', 'center003', TIMESTAMPTZ '2025-08-27 11:00:00+05:30'),
  ('treacle-2025-08-27', 'center004', TIMESTAMPTZ '2025-08-27 12:45:00+05:30')
ON CONFLICT (draft_id, center_id) DO NOTHING;