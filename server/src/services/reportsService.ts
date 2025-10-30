import { pool } from "../db.js";
import { getTableName, type ProductSlug } from "../routes/utils/productTables.js";

export async function fetchFieldCollectionMetrics(product: ProductSlug, targetDate: string) {
  const bucketsTable = getTableName("buckets", product);
  const query = `
    SELECT
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.id::text), NULL) AS draft_ids,
      COUNT(DISTINCT d.id) AS draft_count,
      COUNT(b.id) AS bucket_count,
      COALESCE(SUM(b.quantity), 0) AS total_quantity
    FROM field_collection_drafts d
    LEFT JOIN ${bucketsTable} b ON b.draft_id = d.id
    WHERE d.date::date = $1
      AND LOWER(d.status) IN ('submitted', 'completed')
  `;
  const { rows } = await pool.query(query, [targetDate]);
  return rows[0] ?? {};
}

export async function fetchProcessingMetrics(product: ProductSlug, targetDate: string) {
  const processingTable = getTableName("processingBatches", product);
  const batchBucketTable = getTableName("processingBatchBuckets", product);
  const bucketTable = getTableName("buckets", product);
  const query = `
    WITH bucket_totals AS (
      SELECT pbb.processing_batch_id, COALESCE(SUM(b.quantity), 0) AS total_input
      FROM ${batchBucketTable} pbb
      JOIN ${bucketTable} b ON b.id = pbb.bucket_id
      GROUP BY pbb.processing_batch_id
    )
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(pb.status) = 'completed') AS completed_batches,
      COALESCE(SUM(pb.total_sap_output), 0) AS total_output,
      COALESCE(SUM(pb.used_gas_kg), 0) AS total_gas_used_kg,
      COALESCE(SUM(bucket_totals.total_input), 0) AS total_input
    FROM ${processingTable} pb
    LEFT JOIN bucket_totals ON bucket_totals.processing_batch_id = pb.id
    WHERE pb.scheduled_date::date = $1
      AND LOWER(pb.status) IN ('completed', 'submitted')
  `;
  const { rows } = await pool.query(query, [targetDate]);
  return rows[0] ?? {};
}

export async function fetchPackagingMetrics(product: ProductSlug, targetDate: string) {
  const packagingTable = getTableName("packagingBatches", product);
  const query = `
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed_batches,
      COALESCE(SUM(finished_quantity), 0) AS finished_quantity,
      COALESCE(SUM(bottle_quantity), 0) AS total_bottle_quantity,
      COALESCE(SUM(lid_quantity), 0) AS total_lid_quantity,
      COALESCE(SUM(alufoil_quantity), 0) AS total_alufoil_quantity,
      COALESCE(SUM(vacuum_bag_quantity), 0) AS total_vacuum_bag_quantity,
      COALESCE(SUM(parchment_paper_quantity), 0) AS total_parchment_paper_quantity
    FROM ${packagingTable}
    WHERE started_at::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  return rows[0] ?? {};
}

export async function fetchLabelingMetrics(product: ProductSlug, targetDate: string) {
  const labelingTable = getTableName("labelingBatches", product);
  const query = `
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed_batches,
      COALESCE(SUM(sticker_quantity), 0) AS total_sticker_quantity,
      COALESCE(SUM(shrink_sleeve_quantity), 0) AS total_shrink_sleeve_quantity,
      COALESCE(SUM(neck_tag_quantity), 0) AS total_neck_tag_quantity,
      COALESCE(SUM(corrugated_carton_quantity), 0) AS total_corrugated_carton_quantity
    FROM ${labelingTable}
    WHERE created_at::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  return rows[0] ?? {};
}
