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
  resolveProcessingBatchContext as svcResolveProcessingBatchContext,
  fetchCansForProduct as svcFetchCansForProduct,
  fetchProcessingBatchSummaries as svcFetchProcessingBatchSummaries,
  fetchProcessingBatch as svcFetchProcessingBatch,
  mapCanRow as svcMapCanRow,
} from "../services/processingService.js";

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

const mapCanRow = (row: any) => svcMapCanRow(row);

type ProcessingBatchContext = {
  productType: ProductSlug;
  batchTable: string;
  batchCanTable: string;
  canTable: string;
  draftTable: string;
  packagingTable: string;
  row: any;
};

async function resolveProcessingBatchContext(
  batchId: string,
): Promise<ProcessingBatchContext | null> {
  return svcResolveProcessingBatchContext(batchId) as unknown as ProcessingBatchContext | null;
}

async function fetchCansForProduct(
  productType: ProductSlug,
  statusFilter?: string,
  forBatch?: string,
) {
  return svcFetchCansForProduct(productType, statusFilter, forBatch);
}

async function fetchProcessingBatchSummaries(productType: ProductSlug) {
  return svcFetchProcessingBatchSummaries(productType);
}

async function fetchProcessingBatch(batchId: string) {
  return svcFetchProcessingBatch(batchId);
}

export async function listCans(req: Request, res: Response) {
  try {
    const statusFilter =
      typeof req.query.status === "string" ? (req.query.status as string).toLowerCase() : undefined;
    const forBatch =
      typeof req.query.forBatch === "string" && (req.query.forBatch as string).trim()
        ? (req.query.forBatch as string).trim()
        : undefined;
    let targetProducts: ProductSlug[] = [...SUPPORTED_PRODUCTS];
    if (forBatch) {
      const context = await resolveProcessingBatchContext(forBatch);
      if (!context) return res.status(404).json({ error: "Batch not found" });
      targetProducts = [context.productType];
    }

    const productCans = await Promise.all(
      targetProducts.map((product) => fetchCansForProduct(product, statusFilter, forBatch)),
    );
    const cans = productCans.flat().map(mapCanRow);
    res.json({ cans });
  } catch (error) {
    console.error("Error fetching processing cans:", error);
    res.status(500).json({ error: "Failed to fetch cans" });
  }
}

export async function listBatches(_req: Request, res: Response) {
  try {
    const summaries = await Promise.all(
      SUPPORTED_PRODUCTS.map((product) => fetchProcessingBatchSummaries(product)),
    );
    const batches = summaries.flat().map((row) => ({
      id: row.batch_id as string,
      batchNumber: row.batch_number as string,
      scheduledDate:
        row.scheduled_date instanceof Date
          ? row.scheduled_date.toISOString()
          : (row.scheduled_date as string | null),
      productType: row.product_type as string,
      status: row.status as string,
      totalSapOutput: row.total_sap_output !== null ? Number(row.total_sap_output) : null,
      gasUsedKg: row.used_gas_kg !== null ? Number(row.used_gas_kg) : null,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : (row.created_at as string | null),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : (row.updated_at as string | null),
      canCount: Number(row.can_count ?? 0),
      totalQuantity: Number(row.total_quantity ?? 0),
    }));
    res.json({ batches });
  } catch (error) {
    console.error("Error fetching processing batches:", error);
    res.status(500).json({ error: "Failed to fetch batches" });
  }
}

export async function createBatch(req: Request, res: Response) {
  try {
    const validated = createBatchSchema.parse(req.body ?? {});
    const user = (req as any).user;

    const productType = normalizeProduct(validated.productType) ?? "treacle";
    const batchTable = getTableName("processingBatches", productType);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const nextNumberQuery = `
        SELECT LPAD((COALESCE(MAX(CAST(batch_number AS INTEGER)), 0) + 1)::TEXT, 2, '0') AS next_number
        FROM ${batchTable}
        WHERE batch_number ~ '^[0-9]+$'
      `;

      const { rows: numberRows } = await client.query(nextNumberQuery);
      const nextBatchNumber = numberRows[0]?.next_number ?? "01";

      const batchId = `pb${Date.now()}`;
      const scheduledDate = validated.scheduledDate
        ? new Date(validated.scheduledDate)
        : new Date();

      const insertQuery = `
        INSERT INTO ${batchTable} (
          batch_id,
          batch_number,
          scheduled_date,
          product_type,
          status,
          created_by
        )
        VALUES ($1, $2, $3, $4, 'in-progress', $5)
        RETURNING batch_id, batch_number, scheduled_date, product_type, status, created_at, updated_at, total_sap_output, used_gas_kg
      `;

      const { rows } = await client.query(insertQuery, [
        batchId,
        nextBatchNumber,
        scheduledDate,
        productType,
        user.userId,
      ]);

      await client.query("COMMIT");

      const created = rows[0];

      res.status(201).json({
        id: created.batch_id,
        batchNumber: created.batch_number,
        scheduledDate:
          created.scheduled_date instanceof Date
            ? created.scheduled_date.toISOString()
            : (created.scheduled_date as string | null),
        productType: created.product_type,
        status: created.status,
        totalSapOutput: created.total_sap_output !== null ? Number(created.total_sap_output) : null,
        gasUsedKg: created.used_gas_kg !== null ? Number(created.used_gas_kg) : null,
        createdAt:
          created.created_at instanceof Date
            ? created.created_at.toISOString()
            : (created.created_at as string | null),
        updatedAt:
          created.updated_at instanceof Date
            ? created.updated_at.toISOString()
            : (created.updated_at as string | null),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating processing batch:", error);
    res.status(500).json({ error: "Failed to create batch" });
  }
}

export async function getBatch(req: Request, res: Response) {
  try {
    const { batchId } = req.params as { batchId: string };
    const batch = await fetchProcessingBatch(batchId);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    res.json(batch);
  } catch (error) {
    console.error("Error fetching processing batch:", error);
    res.status(500).json({ error: "Failed to fetch batch" });
  }
}

export async function updateBatch(req: Request, res: Response) {
  try {
    const { batchId } = req.params as { batchId: string };
    const validated = updateBatchSchema.parse(req.body ?? {});

    const context = await resolveProcessingBatchContext(batchId);
    if (!context) return res.status(404).json({ error: "Batch not found" });

    const updateClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (validated.status) {
      updateClauses.push(`status = $${paramIndex}`);
      params.push(validated.status);
      paramIndex++;
    }

    if (validated.scheduledDate) {
      updateClauses.push(`scheduled_date = $${paramIndex}`);
      params.push(new Date(validated.scheduledDate));
      paramIndex++;
    }

    if (validated.productType && normalizeProduct(validated.productType) !== context.productType) {
      return res.status(400).json({ error: "Cannot move batch between products" });
    }

    if (validated.totalSapOutput !== undefined) {
      updateClauses.push(`total_sap_output = $${paramIndex}`);
      params.push(validated.totalSapOutput);
      paramIndex++;
    }

    if (validated.gasUsedKg !== undefined) {
      updateClauses.push(`used_gas_kg = $${paramIndex}`);
      params.push(validated.gasUsedKg);
      paramIndex++;
    }

    if (updateClauses.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(batchId);

    const query = `
      UPDATE ${context.batchTable}
      SET ${updateClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE batch_id = $${paramIndex}
      RETURNING batch_id
    `;

    await pool.query(query, params);
    const updated = await fetchProcessingBatch(batchId);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating processing batch:", error);
    res.status(500).json({ error: "Failed to update batch" });
  }
}

export async function setBatchCans(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const { batchId } = req.params as { batchId: string };
    const validated = updateBatchCansSchema.parse(req.body ?? {});
    const context = await resolveProcessingBatchContext(batchId);
    if (!context) {
      return res.status(404).json({ error: "Batch not found" });
    }
    const batchPk = Number(context.row.id);

    await client.query("BEGIN");

    await client.query(`DELETE FROM ${context.batchCanTable} WHERE processing_batch_id = $1`, [
      batchPk,
    ]);

    if (validated.canIds.length > 0) {
      const canLookupQuery = `
        SELECT id, can_id
        FROM ${context.canTable}
        WHERE can_id = ANY($1::text[])
      `;

      const { rows: canRows } = await client.query(canLookupQuery, [validated.canIds]);

      if (canRows.length !== validated.canIds.length) {
        const foundIds = new Set(canRows.map((can) => can.can_id as string));
        const missing = validated.canIds.filter((id) => !foundIds.has(id));
        throw new Error(`Cans not found: ${missing.join(", ")}`);
      }

      const canPkIds = canRows.map((can) => Number(can.id));

      const conflictQuery = `
        SELECT b.can_id
        FROM ${context.batchCanTable} pbb
        JOIN ${context.canTable} b ON b.id = pbb.can_id
        WHERE pbb.processing_batch_id <> $1 AND pbb.can_id = ANY($2::bigint[])
      `;

      const { rows: conflicts } = await client.query(conflictQuery, [batchPk, canPkIds]);
      if (conflicts.length > 0) {
        const occupied = conflicts.map((conflict) => conflict.can_id as string);
        throw new Error(`Cans already assigned to another batch: ${occupied.join(", ")}`);
      }

      const insertValues = canPkIds.map((_, index) => `($1, $${index + 2})`).join(", ");
      const params = [batchPk, ...canPkIds];

      const insertQuery = `
        INSERT INTO ${context.batchCanTable} (processing_batch_id, can_id)
        VALUES ${insertValues}
      `;

      await client.query(insertQuery, params);
    }

    await client.query("COMMIT");

    const batch = await fetchProcessingBatch(batchId);
    res.json(batch);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating batch cans:", error);
    const message = error instanceof Error ? error.message : "Failed to update batch cans";
    res.status(400).json({ error: message });
  } finally {
    client.release();
  }
}

export async function submitBatch(req: Request, res: Response) {
  const { batchId } = req.params as { batchId: string };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const context = await resolveProcessingBatchContext(batchId);
    if (!context) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Batch not found" });
    }

    const { rows } = await client.query(
      `SELECT id, batch_id, batch_number, status FROM ${context.batchTable} WHERE batch_id = $1 FOR UPDATE`,
      [batchId],
    );
    const batchRow = rows[0];
    if (batchRow.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot submit a cancelled batch" });
    }

    if (batchRow.status !== "completed") {
      await client.query(
        `UPDATE ${context.batchTable} SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [batchRow.id],
      );
    }

    await client.query("COMMIT");

    const updated = await fetchProcessingBatch(batchId);
    if (!updated) return res.status(404).json({ error: "Batch not found" });

    res.json(updated);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Error submitting processing batch:", error);
    res.status(500).json({ error: "Failed to submit batch" });
  } finally {
    client.release();
  }
}

export async function reopenBatch(req: Request, res: Response) {
  const { batchId } = req.params as { batchId: string };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const context = await resolveProcessingBatchContext(batchId);
    if (!context) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Batch not found" });
    }

    const { rows } = await client.query(
      `SELECT id, batch_id, batch_number, status FROM ${context.batchTable} WHERE batch_id = $1 FOR UPDATE`,
      [batchId],
    );
    const batchRow = rows[0];
    if (batchRow.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Cannot reopen a cancelled batch" });
    }

    if (batchRow.status !== "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only completed batches can be reopened" });
    }

    await client.query(
      `UPDATE ${context.batchTable} SET status = 'in-progress', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [batchRow.id],
    );
    await client.query(`DELETE FROM ${context.packagingTable} WHERE processing_batch_id = $1`, [
      batchRow.id,
    ]);

    await client.query("COMMIT");

    const updated = await fetchProcessingBatch(batchId);
    if (!updated) return res.status(404).json({ error: "Batch not found" });

    res.json(updated);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Error reopening processing batch:", error);
    res.status(500).json({ error: "Failed to reopen batch" });
  } finally {
    client.release();
  }
}

export async function deleteBatch(req: Request, res: Response) {
  const { batchId } = req.params as { batchId: string };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const context = await resolveProcessingBatchContext(batchId);
    if (!context) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Batch not found" });
    }

    const batchPk = Number(context.row.id);
    await client.query(`DELETE FROM ${context.batchCanTable} WHERE processing_batch_id = $1`, [
      batchPk,
    ]);
    await client.query(`DELETE FROM ${context.packagingTable} WHERE processing_batch_id = $1`, [
      batchPk,
    ]);
    await client.query(`DELETE FROM ${context.batchTable} WHERE id = $1`, [batchPk]);

    await client.query("COMMIT");
    res.status(204).send();
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Error deleting processing batch:", error);
    res.status(500).json({ error: "Failed to delete processing batch" });
  } finally {
    client.release();
  }
}
