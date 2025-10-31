import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { SUPPORTED_PRODUCTS, getTableName, normalizeProduct, type ProductSlug } from "../routes/utils/productTables.js";
import {
  resolveLabelingContext as svcResolveLabelingContext,
  fetchLabelingRow as svcFetchLabelingRow,
  fetchLabelingBatchByPackagingId as svcFetchLabelingBatchByPackagingId,
  fetchLabelingSummaries as svcFetchLabelingSummaries,
  fetchEligiblePackagingBatches as svcFetchEligiblePackagingBatches,
} from "../services/labelingService.js";

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
    canCount: Number(row.can_count ?? 0),
    totalQuantity: Number(row.total_quantity ?? 0),
    stickerQuantity:
      row.labeling_sticker_quantity !== null ? Number(row.labeling_sticker_quantity) : null,
    shrinkSleeveQuantity:
      row.labeling_shrink_sleeve_quantity !== null ? Number(row.labeling_shrink_sleeve_quantity) : null,
    neckTagQuantity: row.labeling_neck_tag_quantity !== null ? Number(row.labeling_neck_tag_quantity) : null,
    corrugatedCartonQuantity:
      row.labeling_corrugated_carton_quantity !== null ? Number(row.labeling_corrugated_carton_quantity) : null,
  };
}

const LABELING_STATUSES = ["pending", "in-progress", "completed", "on-hold"] as const;
const numericQuantity = z.number().min(0, "Quantity must be greater than or equal to 0").nullable().optional();

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
  return svcFetchEligiblePackagingBatches(productType);
}

async function resolveLabelingContext(packagingId: string): Promise<LabelingContext | null> {
  return (await svcResolveLabelingContext(packagingId)) as unknown as LabelingContext | null;
}

async function fetchLabelingRow(packagingId: string) {
  return svcFetchLabelingRow(packagingId);
}

async function fetchLabelingBatchByPackagingId(packagingId: string) {
  const { context, row } = await svcFetchLabelingBatchByPackagingId(packagingId) as any;
  if (!context || !row) return null;
  const mapped = mapLabelingRow(row);
  return {
    ...mapped,
    packagingDbId: context.packagingPk,
    labelingDbId: row.labeling_pk !== null ? Number(row.labeling_pk) : null,
  };
}

export async function listBatches(_req: Request, res: Response) {
  try {
    const summaries = await Promise.all(SUPPORTED_PRODUCTS.map((product) => fetchLabelingSummaries(product)));
    const batches = summaries.flat();
    res.json({ batches });
  } catch (error) {
    console.error("Error fetching labeling batches:", error);
    res.status(500).json({ error: "Failed to fetch labeling batches" });
  }
}

async function fetchLabelingSummaries(productType: ProductSlug) {
  const rows = await svcFetchLabelingSummaries(productType);
  return rows.map(mapLabelingRow);
}

export async function availablePackaging(req: Request, res: Response) {
  try {
    const productParam = typeof req.query.productType === "string" ? normalizeProduct(req.query.productType) : null;
    const rows = await fetchEligiblePackagingBatches(productParam ?? undefined);
    const batches = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      packagingId: String(row.packaging_id ?? row.packagingId ?? ""),
      processingBatchId: String(row.batch_id ?? row.processing_batch_id ?? ""),
      batchNumber: String(row.batch_number ?? ""),
      productType: String(row.product_type ?? ""),
      scheduledDate:
        row.scheduled_date instanceof Date
          ? row.scheduled_date.toISOString()
          : (row.scheduled_date ?? null),
      finishedQuantity: row.finished_quantity !== null && row.finished_quantity !== undefined ? Number(row.finished_quantity) : null,
      totalSapOutput: row.total_sap_output !== null && row.total_sap_output !== undefined ? Number(row.total_sap_output) : null,
      totalQuantity: Number(row.total_quantity ?? 0),
      canCount: Number(row.can_count ?? 0),
    }));
    res.json({ batches });
  } catch (error) {
    console.error("Error fetching eligible packaging batches for labeling:", error);
    res.status(500).json({ error: "Failed to fetch eligible packaging batches" });
  }
}

export async function getBatch(req: Request, res: Response) {
  try {
    const { packagingId } = req.params as { packagingId: string };
    const batch = await fetchLabelingBatchByPackagingId(packagingId);
    if (!batch) {
      return res.status(404).json({ error: "Labeling batch not found" });
    }
    res.json(batch);
  } catch (error) {
    console.error("Error fetching labeling batch:", error);
    res.status(500).json({ error: "Failed to fetch labeling batch" });
  }
}

export async function createBatch(req: Request, res: Response) {
  try {
    const { packagingId } = createLabelingSchema.parse(req.body ?? {});
    const context = await resolveLabelingContext(packagingId);
    if (!context) return res.status(404).json({ error: "Packaging batch not found" });

    if (context.labelingPk !== null) {
      return res.status(400).json({ error: "Labeling batch already exists for this packaging" });
    }

    const labelingId = `lab${Date.now()}`;
    await pool.query(
      `INSERT INTO ${context.labelingTable} (labeling_id, packaging_batch_id, status)
       VALUES ($1, $2, 'pending')`,
      [labelingId, context.packagingPk]
    );

    const created = await fetchLabelingBatchByPackagingId(packagingId);
    if (!created) return res.status(500).json({ error: "Failed to load created labeling batch" });

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating labeling batch:", error);
    res.status(500).json({ error: "Failed to create labeling batch" });
  }
}

export async function updateBatch(req: Request, res: Response) {
  try {
    const { packagingId } = req.params as { packagingId: string };
    const validated = updateLabelingSchema.parse(req.body ?? {});

    const existing = await fetchLabelingBatchByPackagingId(packagingId);
    if (!existing) return res.status(404).json({ error: "Packaging batch not found" });

    const productType = (existing.productType || "").toLowerCase();
    const sanitized: typeof validated = { ...validated };

    if (sanitized.stickerQuantity === undefined || sanitized.corrugatedCartonQuantity === undefined) {
      return res.status(400).json({ error: "Sticker and corrugated carton quantities are required." });
    }

    if (productType === "treacle") {
      if (sanitized.shrinkSleeveQuantity === undefined || sanitized.neckTagQuantity === undefined) {
        return res.status(400).json({ error: "Shrink sleeve and neck tag quantities are required for treacle (in-house) labeling." });
      }
    } else if (productType === "jaggery") {
      sanitized.shrinkSleeveQuantity = null;
      sanitized.neckTagQuantity = null;
    } else {
      return res.status(400).json({ error: "Unsupported product type for labeling." });
    }

    const stickerQuantityValue = sanitized.stickerQuantity ?? null;
    const shrinkQuantityValue = sanitized.shrinkSleeveQuantity ?? null;
    const neckTagQuantityValue = sanitized.neckTagQuantity ?? null;
    const cartonQuantityValue = sanitized.corrugatedCartonQuantity ?? null;
    const allQuantitiesCaptured =
      productType === "treacle"
        ? stickerQuantityValue !== null && shrinkQuantityValue !== null && neckTagQuantityValue !== null && cartonQuantityValue !== null
        : stickerQuantityValue !== null && cartonQuantityValue !== null;
    const statusValue =
      sanitized.status ?? (existing.labelingId ? (allQuantitiesCaptured ? "completed" : existing.labelingStatus) : allQuantitiesCaptured ? "completed" : "pending");
    const notesValue = sanitized.notes ?? existing.labelingNotes ?? null;

    const context = await resolveLabelingContext(packagingId);
    if (!context) return res.status(404).json({ error: "Packaging batch not found" });

    if (context.labelingPk === null) {
      const insertQuery = `
          INSERT INTO ${context.labelingTable} (
            labeling_id,
            packaging_batch_id,
            status,
            notes,
            sticker_quantity,
            shrink_sleeve_quantity,
            neck_tag_quantity,
            corrugated_carton_quantity
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (packaging_batch_id) DO UPDATE
          SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            sticker_quantity = EXCLUDED.sticker_quantity,
            shrink_sleeve_quantity = EXCLUDED.shrink_sleeve_quantity,
            neck_tag_quantity = EXCLUDED.neck_tag_quantity,
            corrugated_carton_quantity = EXCLUDED.corrugated_carton_quantity,
            updated_at = NOW()
        `;

      await pool.query(insertQuery, [
        packagingId,
        context.packagingPk,
        statusValue,
        notesValue,
        stickerQuantityValue,
        shrinkQuantityValue,
        neckTagQuantityValue,
        cartonQuantityValue,
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
      applyUpdate("sticker_quantity", stickerQuantityValue);
      applyUpdate("shrink_sleeve_quantity", shrinkQuantityValue);
      applyUpdate("neck_tag_quantity", neckTagQuantityValue);
      applyUpdate("corrugated_carton_quantity", cartonQuantityValue);
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
    if (!refreshed) return res.status(500).json({ error: "Failed to load updated labeling batch" });

    res.json(refreshed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating labeling batch:", error);
    res.status(500).json({ error: "Failed to update labeling batch" });
  }
}

export async function deleteBatch(req: Request, res: Response) {
  const { packagingId } = req.params as { packagingId: string };
  try {
    const context = await resolveLabelingContext(packagingId);
    if (!context) return res.status(404).json({ error: "Labeling batch not found" });

    if (context.labelingPk === null) {
      return res.status(204).send();
    }

    await pool.query(`DELETE FROM ${context.labelingTable} WHERE id = $1`, [context.labelingPk]);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting labeling batch:", error);
    res.status(500).json({ error: "Failed to delete labeling batch" });
  }
}
