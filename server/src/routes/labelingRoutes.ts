import express from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
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
      row.scheduled_date instanceof Date ? row.scheduled_date.toISOString() : (row.scheduled_date as string | null),
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
    bucketCount: Number(row.bucket_count ?? 0),
    totalQuantity: Number(row.total_quantity ?? 0),
    stickerCost: row.labeling_sticker_cost !== null ? Number(row.labeling_sticker_cost) : null,
    shrinkSleeveCost: row.labeling_shrink_sleeve_cost !== null ? Number(row.labeling_shrink_sleeve_cost) : null,
    neckTagCost: row.labeling_neck_tag_cost !== null ? Number(row.labeling_neck_tag_cost) : null,
    corrugatedCartonCost:
      row.labeling_corrugated_carton_cost !== null ? Number(row.labeling_corrugated_carton_cost) : null,
  };
}

const LABELING_STATUSES = ["pending", "in-progress", "completed", "on-hold"] as const;
const numericCost = z.number().min(0, "Cost must be greater than or equal to 0").nullable().optional();

const updateLabelingSchema = z.object({
  status: z.enum(LABELING_STATUSES).optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes must be 2000 characters or fewer")
    .optional(),
  stickerCost: numericCost,
  shrinkSleeveCost: numericCost,
  neckTagCost: numericCost,
  corrugatedCartonCost: numericCost,
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
  batchBucketTable: string;
  bucketTable: string;
  packagingPk: number;
  labelingPk: number | null;
};

async function resolveLabelingContext(packagingId: string): Promise<LabelingContext | null> {
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
      lb.sticker_cost AS labeling_sticker_cost,
      lb.shrink_sleeve_cost AS labeling_shrink_sleeve_cost,
      lb.neck_tag_cost AS labeling_neck_tag_cost,
      lb.corrugated_carton_cost AS labeling_corrugated_carton_cost,
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
      lb.sticker_cost,
      lb.shrink_sleeve_cost,
      lb.neck_tag_cost,
      lb.corrugated_carton_cost
  `;

  const { rows } = await pool.query(query, [packagingId]);
  return { context, row: rows[0] ?? null } as const;
}

async function fetchLabelingBatchByPackagingId(packagingId: string): Promise<LabelingDetails | null> {
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
      lb.sticker_cost AS labeling_sticker_cost,
      lb.shrink_sleeve_cost AS labeling_shrink_sleeve_cost,
      lb.neck_tag_cost AS labeling_neck_tag_cost,
      lb.corrugated_carton_cost AS labeling_corrugated_carton_cost,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.bucket_id) AS bucket_count
    FROM ${packagingTable} pkg
    JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${batchBucketTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${bucketTable} b ON b.id = pbb.bucket_id
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
      lb.sticker_cost,
      lb.shrink_sleeve_cost,
      lb.neck_tag_cost,
      lb.corrugated_carton_cost
    ORDER BY pkg.started_at DESC, pkg.packaging_id ASC
  `;

  const { rows } = await pool.query(query);
  return rows.map(mapLabelingRow);
}

router.get(
  "/batches",
  auth,
  requireRole("Labeling", "Packaging", "Administrator"),
  async (_req, res) => {
    try {
      const summaries = await Promise.all(
        SUPPORTED_PRODUCTS.map((product) => fetchLabelingSummaries(product))
      );
      const batches = summaries.flat();
      res.json({ batches });
    } catch (error) {
      console.error("Error fetching labeling batches:", error);
      res.status(500).json({ error: "Failed to fetch labeling batches" });
    }
  }
);

router.patch(
  "/batches/:packagingId",
  auth,
  requireRole("Labeling", "Packaging", "Administrator"),
  async (req, res) => {
    try {
      const { packagingId } = req.params;
      const validated = updateLabelingSchema.parse(req.body ?? {});

      const existing = await fetchLabelingBatchByPackagingId(packagingId);
      if (!existing) {
        return res.status(404).json({ error: "Packaging batch not found" });
      }

      const productType = (existing.productType || "").toLowerCase();
      const sanitized: typeof validated = { ...validated };

      if (sanitized.stickerCost === undefined || sanitized.corrugatedCartonCost === undefined) {
        return res.status(400).json({ error: "Sticker cost and corrugated carton cost are required." });
      }

      if (productType === "sap") {
        if (sanitized.shrinkSleeveCost === undefined || sanitized.neckTagCost === undefined) {
          return res.status(400).json({
            error: "Shrink sleeve and neck tag costs are required for sap labeling.",
          });
        }
      } else if (productType === "treacle") {
        sanitized.shrinkSleeveCost = null;
        sanitized.neckTagCost = null;
      } else {
        return res.status(400).json({ error: "Unsupported product type for labeling." });
      }

      const stickerCostValue = sanitized.stickerCost ?? null;
      const shrinkCostValue = sanitized.shrinkSleeveCost ?? null;
      const neckTagValue = sanitized.neckTagCost ?? null;
      const cartonCostValue = sanitized.corrugatedCartonCost ?? null;
      const allCostsCaptured =
        productType === "sap"
          ? stickerCostValue !== null && shrinkCostValue !== null && neckTagValue !== null && cartonCostValue !== null
          : stickerCostValue !== null && cartonCostValue !== null;
      const statusValue =
        sanitized.status ??
        (existing.labelingId
          ? allCostsCaptured
            ? "completed"
            : existing.labelingStatus
          : allCostsCaptured
          ? "completed"
          : "pending");
      const notesValue = sanitized.notes ?? existing.labelingNotes ?? null;

      const context = await resolveLabelingContext(packagingId);
      if (!context) {
        return res.status(404).json({ error: "Packaging batch not found" });
      }

      if (context.labelingPk === null) {
        const insertQuery = `
          INSERT INTO ${context.labelingTable} (
            labeling_id,
            packaging_batch_id,
            status,
            notes,
            sticker_cost,
            shrink_sleeve_cost,
            neck_tag_cost,
            corrugated_carton_cost
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (packaging_batch_id) DO UPDATE
          SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            sticker_cost = EXCLUDED.sticker_cost,
            shrink_sleeve_cost = EXCLUDED.shrink_sleeve_cost,
            neck_tag_cost = EXCLUDED.neck_tag_cost,
            corrugated_carton_cost = EXCLUDED.corrugated_carton_cost,
            updated_at = NOW()
        `;

        await pool.query(insertQuery, [
          packagingId,
          context.packagingPk,
          statusValue,
          notesValue,
          stickerCostValue,
          shrinkCostValue,
          neckTagValue,
          cartonCostValue,
        ]);
      } else {
        const updateClauses: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        const applyUpdate = (column: string, value: unknown) => {
          updateClauses.push(`${column} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        };

        applyUpdate("status", statusValue);
        applyUpdate("notes", notesValue);
        applyUpdate("sticker_cost", stickerCostValue);
        applyUpdate("shrink_sleeve_cost", shrinkCostValue);
        applyUpdate("neck_tag_cost", neckTagValue);
        applyUpdate("corrugated_carton_cost", cartonCostValue);
        updateClauses.push(`updated_at = NOW()`);

        const updateQuery = `
          UPDATE ${context.labelingTable}
          SET ${updateClauses.join(", ")}
          WHERE packaging_batch_id = $${paramIndex}
        `;

        params.push(context.packagingPk);

        await pool.query(updateQuery, params);
      }

      const refreshed = await fetchLabelingBatchByPackagingId(packagingId);
      if (!refreshed) {
        return res.status(500).json({ error: "Failed to load updated labeling batch" });
      }

      res.json(refreshed);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.issues });
      }
      console.error("Error updating labeling batch:", error);
      res.status(500).json({ error: "Failed to update labeling batch" });
    }
  }
);

export default router;
