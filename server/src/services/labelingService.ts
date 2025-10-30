import { pool } from "../db.js";
import { SUPPORTED_PRODUCTS, getTableName, type ProductSlug } from "../routes/utils/productTables.js";

export type LabelingContext = {
  productType: ProductSlug;
  packagingTable: string;
  labelingTable: string;
  processingBatchTable: string;
  batchBucketTable: string;
  bucketTable: string;
  packagingPk: number;
  labelingPk: number | null;
};

export async function resolveLabelingContext(packagingId: string): Promise<LabelingContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const packagingTable = getTableName("packagingBatches", productType);
    const labelingTable = getTableName("labelingBatches", productType);
    const { rows } = await pool.query(`SELECT id FROM ${packagingTable} WHERE packaging_id = $1`, [packagingId]);
    if (rows.length > 0) {
      const packagingPk = Number(rows[0].id);
      const { rows: labelRows } = await pool.query(
        `SELECT id FROM ${labelingTable} WHERE packaging_batch_id = $1`,
        [packagingPk]
      );
      return {
        productType,
        packagingTable,
        labelingTable,
        processingBatchTable: getTableName("processingBatches", productType),
        batchBucketTable: getTableName("processingBatchBuckets", productType),
        bucketTable: getTableName("buckets", productType),
        packagingPk,
        labelingPk: labelRows.length > 0 ? Number(labelRows[0].id) : null,
      };
    }
  }
  return null;
}

export async function fetchLabelingRow(packagingId: string) {
  const context = await resolveLabelingContext(packagingId);
  if (!context) return { context: null, row: null } as const;

  const query = `
    SELECT
      pkg.id AS packaging_pk,
      pkg.packaging_id,
      pkg.status AS packaging_status,
      pkg.started_at AS packaging_started_at,
      pkg.updated_at AS packaging_updated_at,
      pkg.finished_quantity,
      pb.id AS processing_pk,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status AS processing_status,
      pb.scheduled_date,
      pb.total_sap_output,
      lb.id AS labeling_pk,
      lb.labeling_id,
      lb.status AS labeling_status,
      lb.notes AS labeling_notes,
      lb.sticker_quantity AS labeling_sticker_quantity,
      lb.shrink_sleeve_quantity AS labeling_shrink_sleeve_quantity,
      lb.neck_tag_quantity AS labeling_neck_tag_quantity,
      lb.corrugated_carton_quantity AS labeling_corrugated_carton_quantity,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.bucket_id) AS bucket_count
    FROM ${context.packagingTable} pkg
    JOIN ${context.processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${context.batchBucketTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${context.bucketTable} b ON b.id = pbb.bucket_id
    LEFT JOIN ${context.labelingTable} lb ON lb.packaging_batch_id = pkg.id
    WHERE pkg.packaging_id = $1
    GROUP BY
      pkg.id,
      pkg.packaging_id,
      pkg.status,
      pkg.started_at,
      pkg.updated_at,
      pkg.finished_quantity,
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status,
      pb.scheduled_date,
      pb.total_sap_output,
      lb.id,
      lb.labeling_id,
      lb.status,
      lb.notes,
      lb.sticker_quantity,
      lb.shrink_sleeve_quantity,
      lb.neck_tag_quantity,
      lb.corrugated_carton_quantity
  `;

  const { rows } = await pool.query(query, [packagingId]);
  return { context, row: rows[0] ?? null } as const;
}

export async function fetchLabelingBatchByPackagingId(packagingId: string) {
  const { context, row } = await fetchLabelingRow(packagingId);
  if (!context || !row) return null;
  return { context, row } as const;
}

export async function fetchLabelingSummaries(productType: ProductSlug) {
  const packagingTable = getTableName("packagingBatches", productType);
  const processingBatchTable = getTableName("processingBatches", productType);
  const batchBucketTable = getTableName("processingBatchBuckets", productType);
  const bucketTable = getTableName("buckets", productType);
  const labelingTable = getTableName("labelingBatches", productType);

  const query = `
    SELECT
      pkg.id AS packaging_pk,
      pkg.packaging_id,
      pkg.status AS packaging_status,
      pkg.started_at AS packaging_started_at,
      pkg.updated_at AS packaging_updated_at,
      pkg.finished_quantity,
      pb.id AS processing_pk,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status AS processing_status,
      pb.scheduled_date,
      pb.total_sap_output,
      lb.id AS labeling_pk,
      lb.labeling_id,
      lb.status AS labeling_status,
      lb.notes AS labeling_notes,
      lb.sticker_quantity AS labeling_sticker_quantity,
      lb.shrink_sleeve_quantity AS labeling_shrink_sleeve_quantity,
      lb.neck_tag_quantity AS labeling_neck_tag_quantity,
      lb.corrugated_carton_quantity AS labeling_corrugated_carton_quantity,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.bucket_id) AS bucket_count
    FROM ${packagingTable} pkg
    JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${batchBucketTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${bucketTable} b ON b.id = pbb.bucket_id
    LEFT JOIN ${labelingTable} lb ON lb.packaging_batch_id = pkg.id
    WHERE lb.id IS NOT NULL
    GROUP BY
      pkg.id,
      pkg.packaging_id,
      pkg.status,
      pkg.started_at,
      pkg.updated_at,
      pkg.finished_quantity,
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status,
      pb.scheduled_date,
      pb.total_sap_output,
      lb.id,
      lb.labeling_id,
      lb.status,
      lb.notes,
      lb.sticker_quantity,
      lb.shrink_sleeve_quantity,
      lb.neck_tag_quantity,
      lb.corrugated_carton_quantity
    ORDER BY pkg.started_at DESC, pkg.packaging_id ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
}

export async function fetchEligiblePackagingBatches(productType?: ProductSlug) {
  const products = productType ? [productType] : [...SUPPORTED_PRODUCTS];
  const eligible: Array<any> = [];

  for (const product of products) {
    const packagingTable = getTableName("packagingBatches", product);
    const processingBatchTable = getTableName("processingBatches", product);
    const labelingTable = getTableName("labelingBatches", product);
    const batchBucketTable = getTableName("processingBatchBuckets", product);
    const bucketTable = getTableName("buckets", product);

    const query = `
      SELECT
        pkg.id,
        pkg.packaging_id,
        pkg.finished_quantity,
        pkg.started_at,
        pb.batch_id,
        pb.batch_number,
        pb.product_type,
        pb.scheduled_date,
        pb.total_sap_output,
        COALESCE(SUM(b.quantity), 0) AS total_quantity,
        COUNT(pbb.bucket_id) AS bucket_count
      FROM ${packagingTable} pkg
      JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
      LEFT JOIN ${labelingTable} lb ON lb.packaging_batch_id = pkg.id
      LEFT JOIN ${batchBucketTable} pbb ON pbb.processing_batch_id = pb.id
      LEFT JOIN ${bucketTable} b ON b.id = pbb.bucket_id
      WHERE lb.packaging_batch_id IS NULL AND pkg.status = 'completed'
      GROUP BY
        pkg.id,
        pkg.packaging_id,
        pkg.finished_quantity,
        pkg.started_at,
        pb.batch_id,
        pb.batch_number,
        pb.product_type,
        pb.scheduled_date,
        pb.total_sap_output
      ORDER BY pkg.started_at DESC, pb.batch_number ASC
    `;

    const { rows } = await pool.query(query);
    eligible.push(...rows);
  }

  return eligible;
}
