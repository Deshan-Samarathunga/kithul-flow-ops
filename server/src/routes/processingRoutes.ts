import express from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import {
  listCans as listProcessingCans,
  listBatches as listProcessingBatches,
  createBatch as createProcessingBatch,
  getBatch as getProcessingBatch,
  updateBatch as updateProcessingBatch,
  setBatchCans as setProcessingBatchCans,
  submitBatch as submitProcessingBatch,
  reopenBatch as reopenProcessingBatch,
  deleteBatch as deleteProcessingBatch,
} from "../controllers/processingController.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  normalizeProduct,
  type ProductSlug,
} from "./utils/productTables.js";

const router = express.Router();

const PRODUCT_TYPES = SUPPORTED_PRODUCTS;
const BATCH_STATUSES = ["draft", "in-progress", "completed", "cancelled"] as const;

const createBatchSchema = z.object({
  scheduledDate: z
    .string()
    .optional()
    .refine((val) => (val ? !Number.isNaN(Date.parse(val)) : true), "Invalid scheduled date"),
  productType: z.enum(PRODUCT_TYPES).optional(),
});

const numericMeasurement = z
  .number()
  .min(0, "Value must be greater than or equal to 0")
  .nullable()
  .optional();

const updateBatchSchema = z.object({
  status: z.enum(BATCH_STATUSES).optional(),
  scheduledDate: z
    .string()
    .optional()
    .refine((val) => (val ? !Number.isNaN(Date.parse(val)) : true), "Invalid scheduled date"),
  productType: z.enum(PRODUCT_TYPES).optional(),
  notes: z.string().optional(),
  totalSapOutput: numericMeasurement,
  gasUsedKg: numericMeasurement,
});

const updateBatchCansSchema = z.object({
  canIds: z.array(z.string()).max(15, "A batch can contain at most 15 cans"),
});

const mapCanRow = (row: any) => ({
  id: row.can_id as string,
  quantity: row.quantity !== null ? Number(row.quantity) : 0,
  productType: row.product_type as string,
  brixValue: row.brix_value !== null ? Number(row.brix_value) : null,
  phValue: row.ph_value !== null ? Number(row.ph_value) : null,
  createdAt:
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string | null),
  updatedAt:
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : (row.updated_at as string | null),
  assignedBatchId: row.assigned_batch_id as string | null,
  draft: {
    id: row.draft_id as string,
    date:
      row.draft_date instanceof Date
        ? row.draft_date.toISOString()
        : (row.draft_date as string | null),
    status: row.draft_status as string,
  },
  collectionCenter: {
    id: row.center_id as string,
    name: row.center_name as string,
    location: row.location as string | null,
  },
});

type ProcessingBatchContext = {
  productType: ProductSlug;
  batchTable: string;
  batchCanTable: string;
  canTable: string;
  draftTable: string;
  packagingTable: string;
  row: any;
};

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function resolveProcessingBatchContext(
  batchId: string,
): Promise<ProcessingBatchContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const batchTable = getTableName("processingBatches", productType);
    const { rows } = await pool.query(`SELECT * FROM ${batchTable} WHERE batch_id = $1`, [batchId]);
    if (rows.length > 0) {
      return {
        productType,
        batchTable,
        batchCanTable: getTableName("processingBatchCans", productType),
        canTable: getTableName("cans", productType),
        draftTable: getTableName("drafts", productType),
        packagingTable: getTableName("packagingBatches", productType),
        row: rows[0],
      };
    }
  }
  return null;
}

async function fetchCansForProduct(
  productType: ProductSlug,
  statusFilter?: string,
  forBatch?: string,
) {
  const canTable = getTableName("cans", productType);
  const draftTable = getTableName("drafts", productType);
  const batchCanTable = getTableName("processingBatchCans", productType);
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
			b.can_id,
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
		FROM ${canTable} b
		JOIN ${draftTable} d ON b.draft_id = d.id
		JOIN collection_centers cc ON b.collection_center_id = cc.id
		LEFT JOIN ${batchCanTable} pbb ON pbb.can_id = b.id
		LEFT JOIN ${batchTable} pb ON pb.id = pbb.processing_batch_id
		${whereClause}
		ORDER BY b.created_at ASC, b.can_id ASC
	`;

  const { rows } = await pool.query(query, params);
  return rows;
}

async function fetchProcessingBatchSummaries(productType: ProductSlug) {
  const batchTable = getTableName("processingBatches", productType);
  const batchCanTable = getTableName("processingBatchCans", productType);
  const canTable = getTableName("cans", productType);

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
			COUNT(pbb.can_id) AS can_count
		FROM ${batchTable} pb
		LEFT JOIN ${batchCanTable} pbb ON pb.id = pbb.processing_batch_id
		LEFT JOIN ${canTable} b ON b.id = pbb.can_id
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

async function fetchProcessingBatch(batchId: string) {
  const context = await resolveProcessingBatchContext(batchId);
  if (!context) {
    return null;
  }

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
			COUNT(pbb.can_id) AS can_count
		FROM ${context.batchTable} pb
		LEFT JOIN ${context.batchCanTable} pbb ON pb.id = pbb.processing_batch_id
		LEFT JOIN ${context.canTable} b ON b.id = pbb.can_id
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
  if (rows.length === 0) {
    return null;
  }

  const batchRow = rows[0];

  const cansQuery = `
		SELECT b.can_id
		FROM ${context.batchCanTable} pbb
		JOIN ${context.canTable} b ON b.id = pbb.can_id
		WHERE pbb.processing_batch_id = $1
		ORDER BY pbb.added_at ASC, b.can_id ASC
	`;

  const { rows: canRows } = await pool.query(cansQuery, [batchRow.id]);

  return {
    id: batchRow.batch_id as string,
    batchNumber: batchRow.batch_number as string,
    scheduledDate:
      batchRow.scheduled_date instanceof Date
        ? batchRow.scheduled_date.toISOString()
        : (batchRow.scheduled_date as string | null),
    productType: batchRow.product_type as string,
    status: batchRow.status as string,
    totalSapOutput: batchRow.total_sap_output !== null ? Number(batchRow.total_sap_output) : null,
    gasUsedKg: batchRow.used_gas_kg !== null ? Number(batchRow.used_gas_kg) : null,
    createdBy: batchRow.created_by as string,
    createdAt:
      batchRow.created_at instanceof Date
        ? batchRow.created_at.toISOString()
        : (batchRow.created_at as string | null),
    updatedAt:
      batchRow.updated_at instanceof Date
        ? batchRow.updated_at.toISOString()
        : (batchRow.updated_at as string | null),
    canCount: Number(batchRow.can_count ?? 0),
    totalQuantity: Number(batchRow.total_quantity ?? 0),
    canIds: canRows.map((can) => can.can_id as string),
  };
}

router.get("/cans", auth, requireRole("Processing", "Administrator"), listProcessingCans as any);

router.get(
  "/batches",
  auth,
  requireRole("Processing", "Administrator"),
  listProcessingBatches as any,
);

router.post(
  "/batches",
  auth,
  requireRole("Processing", "Administrator"),
  createProcessingBatch as any,
);

router.get(
  "/batches/:batchId",
  auth,
  requireRole("Processing", "Administrator"),
  getProcessingBatch as any,
);

router.patch(
  "/batches/:batchId",
  auth,
  requireRole("Processing", "Administrator"),
  updateProcessingBatch as any,
);

router.put(
  "/batches/:batchId/cans",
  auth,
  requireRole("Processing", "Administrator"),
  setProcessingBatchCans as any,
);

router.post(
  "/batches/:batchId/submit",
  auth,
  requireRole("Processing", "Administrator"),
  submitProcessingBatch as any,
);

router.post(
  "/batches/:batchId/reopen",
  auth,
  requireRole("Processing", "Administrator"),
  reopenProcessingBatch as any,
);

router.delete(
  "/batches/:batchId",
  auth,
  requireRole("Processing", "Administrator"),
  deleteProcessingBatch as any,
);

export default router;
