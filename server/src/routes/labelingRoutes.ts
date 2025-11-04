import express from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import {
  listBatches as listLabelingBatches,
  availablePackaging as availableLabelingPackaging,
  getBatch as getLabelingBatch,
  createBatch as createLabelingBatch,
  updateBatch as updateLabelingBatch,
  deleteBatch as deleteLabelingBatch,
} from "../controllers/labelingController.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  normalizeProduct,
  type ProductSlug,
} from "./utils/productTables.js";

const router = express.Router();

function mapLabelingRow(row: any) {
  return {
    packagingId: row.packaging_id as string,
    labelingId: row.labeling_id as string | null,
    processingBatchId: row.batch_id as string,
    batchNumber: row.batch_number as string,
    productType: row.product_type as string,
    scheduledDate:
      row.scheduled_date instanceof Date
        ? row.scheduled_date.toISOString()
        : (row.scheduled_date as string | null),
    startedAt:
      row.packaging_started_at instanceof Date
        ? row.packaging_started_at.toISOString()
        : (row.packaging_started_at as string | null),
    updatedAt:
      row.packaging_updated_at instanceof Date
        ? row.packaging_updated_at.toISOString()
        : (row.packaging_updated_at as string | null),
    packagingStatus: row.packaging_status as string,
    processingStatus: row.processing_status as string,
    labelingStatus: (row.labeling_status as string | null) ?? "pending",
    labelingNotes: (row.labeling_notes as string | null) ?? null,
    finishedQuantity: row.finished_quantity !== null ? Number(row.finished_quantity) : null,
    totalSapOutput: row.total_sap_output !== null ? Number(row.total_sap_output) : null,
    canCount: Number(row.can_count ?? 0),
    totalQuantity: Number(row.total_quantity ?? 0),
    stickerQuantity:
      row.labeling_sticker_quantity !== null ? Number(row.labeling_sticker_quantity) : null,
    shrinkSleeveQuantity:
      row.labeling_shrink_sleeve_quantity !== null
        ? Number(row.labeling_shrink_sleeve_quantity)
        : null,
    neckTagQuantity:
      row.labeling_neck_tag_quantity !== null ? Number(row.labeling_neck_tag_quantity) : null,
    corrugatedCartonQuantity:
      row.labeling_corrugated_carton_quantity !== null
        ? Number(row.labeling_corrugated_carton_quantity)
        : null,
  };
}

const LABELING_STATUSES = ["pending", "in-progress", "completed", "on-hold"] as const;
const numericQuantity = z
  .number()
  .min(0, "Quantity must be greater than or equal to 0")
  .nullable()
  .optional();

const updateLabelingSchema = z.object({
  status: z.enum(LABELING_STATUSES).optional(),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
  stickerQuantity: numericQuantity,
  shrinkSleeveQuantity: numericQuantity,
  neckTagQuantity: numericQuantity,
  corrugatedCartonQuantity: numericQuantity,
});

const createLabelingSchema = z.object({
  packagingId: z.string().min(1, "Packaging id is required"),
});

type LabelingDetails = ReturnType<typeof mapLabelingRow> & {
  packagingDbId: number;
  labelingDbId: number | null;
};

type LabelingContext = {
  productType: ProductSlug;
  packagingTable: string;
  labelingTable: string;
  processingBatchTable: string;
  batchCanTable: string;
  canTable: string;
  packagingPk: number;
  labelingPk: number | null;
};

async function fetchEligiblePackagingBatches(productType?: ProductSlug) {
  const products = productType ? [productType] : [...SUPPORTED_PRODUCTS];
  const eligible: Array<{
    packagingId: string;
    batchNumber: string;
    productType: string;
    scheduledDate: string | null;
    finishedQuantity: number | null;
    totalSapOutput: number | null;
    totalQuantity: number;
    canCount: number;
  }> = [];

  for (const product of products) {
    const packagingTable = getTableName("packagingBatches", product);
    const processingBatchTable = getTableName("processingBatches", product);
    const labelingTable = getTableName("labelingBatches", product);
    const batchCanTable = getTableName("processingBatchCans", product);
    const canTable = getTableName("cans", product);

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
        COUNT(pbb.can_id) AS can_count
      FROM ${packagingTable} pkg
      JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
      LEFT JOIN ${labelingTable} lb ON lb.packaging_batch_id = pkg.id
      LEFT JOIN ${batchCanTable} pbb ON pbb.processing_batch_id = pb.id
      LEFT JOIN ${canTable} b ON b.id = pbb.can_id
      WHERE lb.packaging_batch_id IS NULL
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
    for (const row of rows) {
      eligible.push({
        packagingId: row.packaging_id as string,
        batchNumber: row.batch_number as string,
        productType: row.product_type as string,
        scheduledDate:
          row.scheduled_date instanceof Date
            ? row.scheduled_date.toISOString()
            : (row.scheduled_date as string | null),
        finishedQuantity: row.finished_quantity !== null ? Number(row.finished_quantity) : null,
        totalSapOutput: row.total_sap_output !== null ? Number(row.total_sap_output) : null,
        totalQuantity: Number(row.total_quantity ?? 0),
        canCount: Number(row.can_count ?? 0),
      });
    }
  }

  return eligible;
}

async function resolveLabelingContext(packagingId: string): Promise<LabelingContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const packagingTable = getTableName("packagingBatches", productType);
    const labelingTable = getTableName("labelingBatches", productType);
    const { rows } = await pool.query(`SELECT id FROM ${packagingTable} WHERE packaging_id = $1`, [
      packagingId,
    ]);
    if (rows.length > 0) {
      const packagingPk = Number(rows[0].id);
      const { rows: labelRows } = await pool.query(
        `SELECT id FROM ${labelingTable} WHERE packaging_batch_id = $1`,
        [packagingPk],
      );
      return {
        productType,
        packagingTable,
        labelingTable,
        processingBatchTable: getTableName("processingBatches", productType),
        batchCanTable: getTableName("processingBatchCans", productType),
        canTable: getTableName("cans", productType),
        packagingPk,
        labelingPk: labelRows.length > 0 ? Number(labelRows[0].id) : null,
      };
    }
  }
  return null;
}

async function fetchLabelingRow(packagingId: string) {
  const context = await resolveLabelingContext(packagingId);
  if (!context) {
    return { context: null, row: null } as const;
  }

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
      COUNT(pbb.can_id) AS can_count
    FROM ${context.packagingTable} pkg
    JOIN ${context.processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${context.batchCanTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${context.canTable} b ON b.id = pbb.can_id
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

async function fetchLabelingBatchByPackagingId(
  packagingId: string,
): Promise<LabelingDetails | null> {
  const { context, row } = await fetchLabelingRow(packagingId);
  if (!context || !row) {
    return null;
  }

  const mapped = mapLabelingRow(row);
  return {
    ...mapped,
    packagingDbId: context.packagingPk,
    labelingDbId: row.labeling_pk !== null ? Number(row.labeling_pk) : null,
  };
}

async function fetchLabelingSummaries(productType: ProductSlug) {
  const packagingTable = getTableName("packagingBatches", productType);
  const processingBatchTable = getTableName("processingBatches", productType);
  const batchCanTable = getTableName("processingBatchCans", productType);
  const canTable = getTableName("cans", productType);
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
      COUNT(pbb.can_id) AS can_count
    FROM ${packagingTable} pkg
    JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${batchCanTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${canTable} b ON b.id = pbb.can_id
    LEFT JOIN ${labelingTable} lb ON lb.packaging_batch_id = pkg.id
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
  return rows.map(mapLabelingRow);
}

router.get(
  "/batches/:packagingId",
  auth,
  requireRole("Labeling", "Packaging", "Administrator"),
  getLabelingBatch as any,
);

router.get(
  "/batches",
  auth,
  requireRole("Labeling", "Packaging", "Administrator"),
  listLabelingBatches as any,
);

router.get(
  "/available-packaging",
  auth,
  requireRole("Labeling", "Packaging", "Administrator"),
  availableLabelingPackaging as any,
);

router.post("/batches", auth, requireRole("Labeling", "Administrator"), createLabelingBatch as any);

router.patch(
  "/batches/:packagingId",
  auth,
  requireRole("Labeling", "Packaging", "Administrator"),
  updateLabelingBatch as any,
);

router.delete(
  "/batches/:packagingId",
  auth,
  requireRole("Labeling", "Administrator"),
  deleteLabelingBatch as any,
);

export default router;
