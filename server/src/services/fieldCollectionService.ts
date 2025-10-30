import { pool } from "../db.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  type ProductSlug,
} from "../routes/utils/productTables.js";

export const DRAFTS_TABLE = "field_collection_drafts";
export const CENTER_COMPLETIONS_TABLE = "field_collection_center_completions";

export async function resolveDraftContext(draftId: string) {
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS created_by_name FROM ${DRAFTS_TABLE} d LEFT JOIN users u ON d.created_by = u.user_id WHERE d.draft_id = $1`,
    [draftId]
  );
  if (rows.length === 0) return null;
  return { row: rows[0] };
}

export async function fetchDraftRowByInternalId(id: unknown) {
  if (typeof id !== "number" && typeof id !== "string") return null;
  const { rows } = await pool.query(`SELECT * FROM ${DRAFTS_TABLE} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function resolveBucketContext(bucketId: string) {
  for (const productType of SUPPORTED_PRODUCTS) {
    const table = getTableName("buckets", productType);
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE bucket_id = $1`, [bucketId]);
    if (rows.length > 0) {
      return { productType, table, row: rows[0] } as const;
    }
  }
  return null;
}

export async function fetchDraftSummaries(
  productFilter?: ProductSlug | null,
  statusFilter?: string,
  createdByFilter?: string | null
) {
  const BUCKET_TOTALS_SOURCE = SUPPORTED_PRODUCTS.map(
    (product) => `SELECT draft_id, quantity FROM ${getTableName("buckets", product)}`
  ).join(" UNION ALL ");

  const params: unknown[] = [];
  const whereClauses: string[] = [];

  if (statusFilter) {
    whereClauses.push(`LOWER(d.status) = $${params.length + 1}`);
    params.push(statusFilter);
  }
  if (productFilter) {
    whereClauses.push(`EXISTS (SELECT 1 FROM ${getTableName("buckets", productFilter)} b WHERE b.draft_id = d.id)`);
  }
  if (createdByFilter) {
    whereClauses.push(`d.created_by = $${params.length + 1}`);
    params.push(createdByFilter);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    WITH bucket_totals AS (
      SELECT draft_id, COUNT(*) AS bucket_count, COALESCE(SUM(quantity), 0) AS total_quantity
      FROM (${BUCKET_TOTALS_SOURCE}) AS all_buckets
      GROUP BY draft_id
    )
    SELECT
      d.id,
      d.draft_id,
      d.date,
      d.status,
      u.name AS created_by_name,
      COALESCE(bucket_totals.bucket_count, 0) AS bucket_count,
      COALESCE(bucket_totals.total_quantity, 0) AS total_quantity,
      d.created_at,
      d.updated_at
    FROM ${DRAFTS_TABLE} d
    LEFT JOIN users u ON d.created_by = u.user_id
    LEFT JOIN bucket_totals ON bucket_totals.draft_id = d.id
    ${whereSql}
    ORDER BY d.date DESC, d.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows;
}
