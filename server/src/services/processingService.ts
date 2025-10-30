import { pool } from "../db.js";
import { SUPPORTED_PRODUCTS, getTableName, type ProductSlug } from "../routes/utils/productTables.js";

export const mapBucketRow = (row: any) => ({
  id: row.bucket_id as string,
  quantity: row.quantity !== null ? Number(row.quantity) : 0,
  productType: row.product_type as string,
  brixValue: row.brix_value !== null ? Number(row.brix_value) : null,
  phValue: row.ph_value !== null ? Number(row.ph_value) : null,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string | null),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at as string | null),
  assignedBatchId: row.assigned_batch_id as string | null,
  draft: {
    id: row.draft_id as string,
    date: row.draft_date instanceof Date ? row.draft_date.toISOString() : (row.draft_date as string | null),
    status: row.draft_status as string,
  },
  collectionCenter: {
    id: row.center_id as string,
    name: row.center_name as string,
    location: row.location as string | null,
  },
});

export type ProcessingBatchContext = {
  productType: ProductSlug;
  batchTable: string;
  batchBucketTable: string;
  bucketTable: string;
  draftTable: string;
  packagingTable: string;
  row: any;
};

export async function resolveProcessingBatchContext(batchId: string): Promise<ProcessingBatchContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const batchTable = getTableName("processingBatches", productType);
    const { rows } = await pool.query(`SELECT * FROM ${batchTable} WHERE batch_id = $1`, [batchId]);
    if (rows.length > 0) {
      return {
        productType,
        batchTable,
        batchBucketTable: getTableName("processingBatchBuckets", productType),
        bucketTable: getTableName("buckets", productType),
        draftTable: getTableName("drafts", productType),
        packagingTable: getTableName("packagingBatches", productType),
        row: rows[0],
      };
    }
  }
  return null;
}

export async function fetchBucketsForProduct(productType: ProductSlug, statusFilter?: string, forBatch?: string) {
  const bucketTable = getTableName("buckets", productType);
  const draftTable = getTableName("drafts", productType);
  const batchBucketTable = getTableName("processingBatchBuckets", productType);
  const batchTable = getTableName("processingBatches", productType);

  const params: any[] = [];
  const filters: string[] = [];
  let paramIndex = 1;

  if (statusFilter === "active") {
    filters.push("d.status <> 'completed'");
  }

  if (forBatch) {
    filters.push(`(pbb.processing_batch_id IS NULL OR pb.batch_id = $${paramIndex})`);
    params.push(forBatch);
    paramIndex++;
  } else {
    filters.push("pbb.processing_batch_id IS NULL");
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const query = `
    SELECT
      b.bucket_id,
      b.quantity,
      b.product_type,
      b.brix_value,
      b.ph_value,
      b.created_at,
      b.updated_at,
      d.draft_id AS draft_id,
      d.date AS draft_date,
      d.status AS draft_status,
      cc.center_id AS center_id,
      cc.center_name,
      cc.location,
      pb.batch_id AS assigned_batch_id
    FROM ${bucketTable} b
    JOIN ${draftTable} d ON b.draft_id = d.id
    JOIN collection_centers cc ON b.collection_center_id = cc.id
    LEFT JOIN ${batchBucketTable} pbb ON pbb.bucket_id = b.id
    LEFT JOIN ${batchTable} pb ON pb.id = pbb.processing_batch_id
    ${whereClause}
    ORDER BY b.created_at ASC, b.bucket_id ASC
  `;

  const { rows } = await pool.query(query, params);
  return rows;
}

export async function fetchProcessingBatchSummaries(productType: ProductSlug) {
  const batchTable = getTableName("processingBatches", productType);
  const batchBucketTable = getTableName("processingBatchBuckets", productType);
  const bucketTable = getTableName("buckets", productType);

  const query = `
    SELECT
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.scheduled_date,
      pb.product_type,
      pb.status,
      pb.total_sap_output,
      pb.used_gas_kg,
      pb.created_at,
      pb.updated_at,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.bucket_id) AS bucket_count
    FROM ${batchTable} pb
    LEFT JOIN ${batchBucketTable} pbb ON pb.id = pbb.processing_batch_id
    LEFT JOIN ${bucketTable} b ON b.id = pbb.bucket_id
    GROUP BY
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.scheduled_date,
      pb.product_type,
      pb.status,
      pb.total_sap_output,
      pb.used_gas_kg,
      pb.created_at,
      pb.updated_at
    ORDER BY pb.scheduled_date ASC, pb.created_at ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
}

export async function fetchProcessingBatch(batchId: string) {
  const context = await resolveProcessingBatchContext(batchId);
  if (!context) return null;

  const batchQuery = `
    SELECT
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.scheduled_date,
      pb.product_type,
      pb.status,
      pb.total_sap_output,
      pb.used_gas_kg,
      pb.created_by,
      pb.created_at,
      pb.updated_at,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.bucket_id) AS bucket_count
    FROM ${context.batchTable} pb
    LEFT JOIN ${context.batchBucketTable} pbb ON pb.id = pbb.processing_batch_id
    LEFT JOIN ${context.bucketTable} b ON b.id = pbb.bucket_id
    WHERE pb.batch_id = $1
    GROUP BY
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.scheduled_date,
      pb.product_type,
      pb.status,
      pb.total_sap_output,
      pb.used_gas_kg,
      pb.created_by,
      pb.created_at,
      pb.updated_at
  `;

  const { rows } = await pool.query(batchQuery, [batchId]);
  if (rows.length === 0) return null;

  const batchRow = rows[0];

  const bucketsQuery = `
    SELECT b.bucket_id
    FROM ${context.batchBucketTable} pbb
    JOIN ${context.bucketTable} b ON b.id = pbb.bucket_id
    WHERE pbb.processing_batch_id = $1
    ORDER BY pbb.added_at ASC, b.bucket_id ASC
  `;

  const { rows: bucketRows } = await pool.query(bucketsQuery, [batchRow.id]);

  return {
    id: batchRow.batch_id as string,
    batchNumber: batchRow.batch_number as string,
    scheduledDate: batchRow.scheduled_date instanceof Date ? batchRow.scheduled_date.toISOString() : (batchRow.scheduled_date as string | null),
    productType: batchRow.product_type as string,
    status: batchRow.status as string,
    totalSapOutput: batchRow.total_sap_output !== null ? Number(batchRow.total_sap_output) : null,
    gasUsedKg: batchRow.used_gas_kg !== null ? Number(batchRow.used_gas_kg) : null,
    createdBy: batchRow.created_by as string,
    createdAt: batchRow.created_at instanceof Date ? batchRow.created_at.toISOString() : (batchRow.created_at as string | null),
    updatedAt: batchRow.updated_at instanceof Date ? batchRow.updated_at.toISOString() : (batchRow.updated_at as string | null),
    bucketCount: Number(batchRow.bucket_count ?? 0),
    totalQuantity: Number(batchRow.total_quantity ?? 0),
    bucketIds: bucketRows.map((bucket) => bucket.bucket_id as string),
  };
}
