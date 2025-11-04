import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  normalizeProduct,
  type ProductSlug,
} from "../routes/utils/productTables.js";
import {
  resolvePackagingContext as svcResolvePackagingContext,
  resolveProcessingContextByBatchId as svcResolveProcessingContextByBatchId,
  fetchPackagingBatchByPackagingId as svcFetchPackagingBatchByPackagingId,
  fetchEligibleProcessingBatches as svcFetchEligibleProcessingBatches,
  fetchPackagingSummaries as svcFetchPackagingSummaries,
} from "../services/packagingService.js";

function mapPackagingRow(row: any) {
  return {
    id: row.packaging_id as string,
    packagingId: row.packaging_id as string,
    processingBatchId: row.batch_id as string,
    batchNumber: row.batch_number as string,
    productType: row.product_type as string,
    scheduledDate:
      row.scheduled_date instanceof Date
        ? row.scheduled_date.toISOString()
        : (row.scheduled_date as string | null),
    startedAt:
      row.started_at instanceof Date
        ? row.started_at.toISOString()
        : (row.started_at as string | null),
    updatedAt:
      row.packaging_updated_at instanceof Date
        ? row.packaging_updated_at.toISOString()
        : (row.packaging_updated_at as string | null),
    packagingStatus: row.packaging_status as string,
    processingStatus: row.processing_status as string,
    notes: row.packaging_notes as string | null,
    canCount: Number(row.can_count ?? 0),
    totalQuantity: Number(row.total_quantity ?? 0),
    totalSapOutput: row.total_sap_output !== null ? Number(row.total_sap_output) : null,
    finishedQuantity: row.finished_quantity !== null ? Number(row.finished_quantity) : null,
    bottleQuantity: row.bottle_quantity !== null ? Number(row.bottle_quantity) : null,
    lidQuantity: row.lid_quantity !== null ? Number(row.lid_quantity) : null,
    alufoilQuantity: row.alufoil_quantity !== null ? Number(row.alufoil_quantity) : null,
    vacuumBagQuantity: row.vacuum_bag_quantity !== null ? Number(row.vacuum_bag_quantity) : null,
    parchmentPaperQuantity:
      row.parchment_paper_quantity !== null ? Number(row.parchment_paper_quantity) : null,
  };
}

const PACKAGING_STATUSES = ["pending", "in-progress", "completed", "on-hold"] as const;

const createPackagingSchema = z.object({
  processingBatchId: z.string().min(1, "Processing batch id is required"),
});

const numericQuantity = z
  .number()
  .min(0, "Quantity must be greater than or equal to 0")
  .nullable()
  .optional();

const updatePackagingSchema = z.object({
  status: z.enum(PACKAGING_STATUSES).optional(),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
  finishedQuantity: z
    .number()
    .min(0, "Finished quantity must be greater than or equal to 0")
    .optional(),
  bottleQuantity: numericQuantity,
  lidQuantity: numericQuantity,
  alufoilQuantity: numericQuantity,
  vacuumBagQuantity: numericQuantity,
  parchmentPaperQuantity: numericQuantity,
});

type PackagingContext = {
  productType: ProductSlug;
  packagingTable: string;
  processingBatchTable: string;
  batchCanTable: string;
  canTable: string;
  row: any;
};

type ProcessingContext = {
  productType: ProductSlug;
  processingTable: string;
  packagingTable: string;
  batchCanTable: string;
  canTable: string;
  row: any;
};

async function resolvePackagingContext(packagingId: string): Promise<PackagingContext | null> {
  return (await svcResolvePackagingContext(packagingId)) as unknown as PackagingContext | null;
}

async function resolveProcessingContextByBatchId(
  batchId: string,
): Promise<ProcessingContext | null> {
  return (await svcResolveProcessingContextByBatchId(
    batchId,
  )) as unknown as ProcessingContext | null;
}

async function fetchPackagingBatchByPackagingId(packagingId: string) {
  const row = await svcFetchPackagingBatchByPackagingId(packagingId);
  if (!row) return null;
  return mapPackagingRow(row);
}

async function fetchEligibleProcessingBatches(productType?: ProductSlug) {
  return svcFetchEligibleProcessingBatches(productType);
}

async function fetchPackagingSummaries(productType: ProductSlug) {
  return svcFetchPackagingSummaries(productType);
}

// Handlers
export async function listBatches(_req: Request, res: Response) {
  try {
    const summaries = await Promise.all(
      SUPPORTED_PRODUCTS.map((product) => fetchPackagingSummaries(product)),
    );
    const batches = summaries.flat().map(mapPackagingRow);
    res.json({ batches });
  } catch (error) {
    console.error("Error fetching packaging batches:", error);
    res.status(500).json({ error: "Failed to fetch packaging batches" });
  }
}

export async function availableProcessing(req: Request, res: Response) {
  try {
    const productParam =
      typeof req.query.productType === "string" ? normalizeProduct(req.query.productType) : null;
    const rows = await fetchEligibleProcessingBatches(productParam ?? undefined);
    const batches = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      processingBatchId: String(row.batch_id ?? row.processing_batch_id ?? row.id ?? ""),
      batchNumber: String(row.batch_number ?? ""),
      productType: String(row.product_type ?? ""),
      scheduledDate:
        row.scheduled_date instanceof Date
          ? row.scheduled_date.toISOString()
          : (row.scheduled_date ?? null),
      totalSapOutput:
        row.total_sap_output !== null && row.total_sap_output !== undefined
          ? Number(row.total_sap_output)
          : null,
      totalQuantity: Number(row.total_quantity ?? 0),
      canCount: Number(row.can_count ?? 0),
    }));
    res.json({ batches });
  } catch (error) {
    console.error("Error fetching eligible processing batches for packaging:", error);
    res.status(500).json({ error: "Failed to fetch eligible processing batches" });
  }
}

export async function createBatch(req: Request, res: Response) {
  try {
    const { processingBatchId } = createPackagingSchema.parse(req.body ?? {});
    const context = await resolveProcessingContextByBatchId(processingBatchId);
    if (!context) {
      return res.status(404).json({ error: "Processing batch not found" });
    }

    const processingPk = Number(context.row.id);
    const { rows: existing } = await pool.query(
      `SELECT packaging_id FROM ${context.packagingTable} WHERE processing_batch_id = $1`,
      [processingPk],
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ error: "Packaging batch already exists for this processing batch" });
    }

    const packagingId = `pkg${Date.now()}`;
    await pool.query(
      `INSERT INTO ${context.packagingTable} (packaging_id, processing_batch_id, status, started_at)
			 VALUES ($1, $2, 'pending', NOW())`,
      [packagingId, processingPk],
    );

    const created = await fetchPackagingBatchByPackagingId(packagingId);
    if (!created) {
      return res.status(500).json({ error: "Failed to load created packaging batch" });
    }

    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating packaging batch:", error);
    res.status(500).json({ error: "Failed to create packaging batch" });
  }
}

export async function getBatch(req: Request, res: Response) {
  try {
    const { packagingId } = req.params as { packagingId: string };
    const batch = await fetchPackagingBatchByPackagingId(packagingId);
    if (!batch) {
      return res.status(404).json({ error: "Packaging batch not found" });
    }
    res.json(batch);
  } catch (error) {
    console.error("Error fetching packaging batch:", error);
    res.status(500).json({ error: "Failed to fetch packaging batch" });
  }
}

export async function updateBatch(req: Request, res: Response) {
  try {
    const { packagingId } = req.params as { packagingId: string };
    const validated = updatePackagingSchema.parse(req.body ?? {});

    const existing = await fetchPackagingBatchByPackagingId(packagingId);
    if (!existing) {
      return res.status(404).json({ error: "Packaging batch not found" });
    }

    const productType = (existing.productType || "").toLowerCase();

    if (productType === "treacle") {
      if (validated.bottleQuantity === undefined || validated.lidQuantity === undefined) {
        return res
          .status(400)
          .json({
            error: "Bottle and lid quantities are required for treacle (in-house) packaging.",
          });
      }
    } else if (productType === "jaggery") {
      if (
        validated.alufoilQuantity === undefined ||
        validated.vacuumBagQuantity === undefined ||
        validated.parchmentPaperQuantity === undefined
      ) {
        return res.status(400).json({
          error:
            "Alufoil, vacuum bag, and parchment paper quantities are required for jaggery packaging.",
        });
      }
    }

    const finishedQuantityValue = validated.finishedQuantity;
    if (finishedQuantityValue === undefined) {
      return res.status(400).json({ error: "Finished quantity is required for packaging." });
    }

    const updateClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const applyQuantityUpdate = (field: keyof typeof validated, dbColumn: string) => {
      const value = (validated as any)[field];
      if (value !== undefined) {
        updateClauses.push(`${dbColumn} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    };

    applyQuantityUpdate("finishedQuantity", "finished_quantity");
    applyQuantityUpdate("bottleQuantity", "bottle_quantity");
    applyQuantityUpdate("lidQuantity", "lid_quantity");
    applyQuantityUpdate("alufoilQuantity", "alufoil_quantity");
    applyQuantityUpdate("vacuumBagQuantity", "vacuum_bag_quantity");
    applyQuantityUpdate("parchmentPaperQuantity", "parchment_paper_quantity");

    if (validated.status) {
      updateClauses.push(`status = $${paramIndex}`);
      params.push(validated.status);
      paramIndex++;
    }

    if (validated.notes !== undefined) {
      updateClauses.push(`notes = $${paramIndex}`);
      params.push(validated.notes);
      paramIndex++;
    }

    if (updateClauses.length === 0) {
      return res.status(400).json({ error: "No fields provided to update." });
    }

    updateClauses.push(`updated_at = NOW()`);

    const context = await resolvePackagingContext(packagingId);
    if (!context) {
      return res.status(404).json({ error: "Packaging batch not found" });
    }

    const updateQuery = `
			UPDATE ${context.packagingTable}
			SET ${updateClauses.join(", ")}
			WHERE packaging_id = $${paramIndex}
		`;

    params.push(packagingId);

    await pool.query(updateQuery, params);

    const refreshed = await fetchPackagingBatchByPackagingId(packagingId);
    if (!refreshed) {
      return res.status(500).json({ error: "Failed to load updated packaging batch" });
    }

    res.json(refreshed);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating packaging batch:", error);
    res.status(500).json({ error: "Failed to update packaging batch" });
  }
}

export async function deleteBatch(req: Request, res: Response) {
  const { packagingId } = req.params as { packagingId: string };
  try {
    const context = await resolvePackagingContext(packagingId);
    if (!context) {
      return res.status(404).json({ error: "Packaging batch not found" });
    }

    await pool.query(`DELETE FROM ${context.packagingTable} WHERE packaging_id = $1`, [
      packagingId,
    ]);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting packaging batch:", error);
    res.status(500).json({ error: "Failed to delete packaging batch" });
  }
}
