import { pool } from "../db.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  type ProductSlug,
} from "../routes/utils/productTables.js";

export type PackagingContext = {
  productType: ProductSlug;
  packagingTable: string;
  processingBatchTable: string;
  batchCanTable: string;
  canTable: string;
  row: any;
};

export type ProcessingContext = {
  productType: ProductSlug;
  processingTable: string;
  packagingTable: string;
  batchCanTable: string;
  canTable: string;
  row: any;
};

export async function resolvePackagingContext(
  packagingId: string,
): Promise<PackagingContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const packagingTable = getTableName("packagingBatches", productType);
    const { rows } = await pool.query(`SELECT * FROM ${packagingTable} WHERE packaging_id = $1`, [
      packagingId,
    ]);
    if (rows.length > 0) {
      return {
        productType,
        packagingTable,
        processingBatchTable: getTableName("processingBatches", productType),
        batchCanTable: getTableName("processingBatchCans", productType),
        canTable: getTableName("cans", productType),
        row: rows[0],
      };
    }
  }
  return null;
}

export async function resolveProcessingContextByBatchId(
  batchId: string,
): Promise<ProcessingContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const processingTable = getTableName("processingBatches", productType);
    const { rows } = await pool.query(`SELECT * FROM ${processingTable} WHERE batch_id = $1`, [
      batchId,
    ]);
    if (rows.length > 0) {
      return {
        productType,
        processingTable,
        packagingTable: getTableName("packagingBatches", productType),
        batchCanTable: getTableName("processingBatchCans", productType),
        canTable: getTableName("cans", productType),
        row: rows[0],
      };
    }
  }
  return null;
}

export async function fetchPackagingBatchByPackagingId(packagingId: string) {
  const context = await resolvePackagingContext(packagingId);
  if (!context) return null;

  const query = `
    SELECT
      pkg.packaging_id,
      pkg.status AS packaging_status,
      pkg.started_at,
      pkg.updated_at AS packaging_updated_at,
      pkg.notes AS packaging_notes,
      pkg.bottle_quantity,
      pkg.lid_quantity,
      pkg.alufoil_quantity,
      pkg.vacuum_bag_quantity,
      pkg.parchment_paper_quantity,
      pkg.finished_quantity,
      pb.id AS processing_pk,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status AS processing_status,
      pb.scheduled_date,
      pb.total_sap_output,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.can_id) AS can_count
    FROM ${context.packagingTable} pkg
    JOIN ${context.processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${context.batchCanTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${context.canTable} b ON b.id = pbb.can_id
    WHERE pkg.packaging_id = $1
    GROUP BY
      pkg.packaging_id,
      pkg.status,
      pkg.started_at,
      pkg.updated_at,
      pkg.notes,
      pkg.bottle_quantity,
      pkg.lid_quantity,
      pkg.alufoil_quantity,
      pkg.vacuum_bag_quantity,
      pkg.parchment_paper_quantity,
      pkg.finished_quantity,
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status,
      pb.scheduled_date,
      pb.total_sap_output
  `;

  const { rows } = await pool.query(query, [packagingId]);
  if (rows.length === 0) return null;
  return rows[0];
}

export async function fetchEligibleProcessingBatches(productType?: ProductSlug) {
  const products = productType ? [productType] : [...SUPPORTED_PRODUCTS];
  const eligible: Array<any> = [];

  for (const product of products) {
    const processingTable = getTableName("processingBatches", product);
    const packagingTable = getTableName("packagingBatches", product);
    const batchCanTable = getTableName("processingBatchCans", product);
    const canTable = getTableName("cans", product);

    const query = `
      SELECT
        pb.id,
        pb.batch_id,
        pb.batch_number,
        pb.product_type,
        pb.scheduled_date,
        pb.total_sap_output,
        COALESCE(SUM(b.quantity), 0) AS total_quantity,
        COUNT(pbb.can_id) AS can_count
      FROM ${processingTable} pb
      LEFT JOIN ${packagingTable} pkg ON pkg.processing_batch_id = pb.id
      LEFT JOIN ${batchCanTable} pbb ON pbb.processing_batch_id = pb.id
      LEFT JOIN ${canTable} b ON b.id = pbb.can_id
      WHERE pb.status = 'completed' AND pkg.processing_batch_id IS NULL
      GROUP BY pb.id, pb.batch_id, pb.batch_number, pb.product_type, pb.scheduled_date, pb.total_sap_output
      ORDER BY pb.scheduled_date DESC, pb.batch_number ASC
    `;

    const { rows } = await pool.query(query);
    eligible.push(...rows);
  }

  return eligible;
}

export async function fetchPackagingSummaries(productType: ProductSlug) {
  const packagingTable = getTableName("packagingBatches", productType);
  const processingBatchTable = getTableName("processingBatches", productType);
  const batchCanTable = getTableName("processingBatchCans", productType);
  const canTable = getTableName("cans", productType);

  const query = `
    SELECT
      pkg.packaging_id,
      pkg.status AS packaging_status,
      pkg.started_at,
      pkg.updated_at AS packaging_updated_at,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status AS processing_status,
      pb.scheduled_date,
      pb.total_sap_output,
      pkg.notes AS packaging_notes,
      pkg.bottle_quantity,
      pkg.lid_quantity,
      pkg.alufoil_quantity,
      pkg.vacuum_bag_quantity,
      pkg.parchment_paper_quantity,
      pkg.finished_quantity,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.can_id) AS can_count
    FROM ${packagingTable} pkg
    JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${batchCanTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${canTable} b ON b.id = pbb.can_id
    GROUP BY
      pkg.packaging_id,
      pkg.status,
      pkg.started_at,
      pkg.updated_at,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status,
      pb.scheduled_date,
      pb.total_sap_output,
      pkg.notes,
      pkg.bottle_quantity,
      pkg.lid_quantity,
      pkg.alufoil_quantity,
      pkg.vacuum_bag_quantity,
      pkg.parchment_paper_quantity,
      pkg.finished_quantity
    ORDER BY pkg.started_at DESC, pkg.packaging_id ASC
  `;

  const { rows } = await pool.query(query);
  return rows;
}
