import express from "express";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import { z } from "zod";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  normalizeProduct,
  type ProductSlug,
} from "./utils/productTables.js";

const router = express.Router();

const DEFAULT_PRODUCT: ProductSlug = "sap";

const createDraftSchema = z.object({
  productType: z.enum(["sap", "treacle"]).optional(),
  date: z.string().optional(),
});

const updateDraftSchema = z.object({
  status: z.enum(["draft", "submitted", "completed"]).optional(),
});

const createBucketSchema = z.object({
  draftId: z.string(),
  collectionCenterId: z.string(),
  productType: z.enum(["sap", "treacle"]),
  brixValue: z.number().min(0).max(100).optional(),
  phValue: z.number().min(0).max(14).optional(),
  quantity: z.number().positive(),
});

const updateBucketSchema = z.object({
  brixValue: z.number().min(0).max(100).optional(),
  phValue: z.number().min(0).max(14).optional(),
  quantity: z.number().positive().optional(),
});

const BUCKET_UPDATE_FIELD_MAP: Record<keyof z.infer<typeof updateBucketSchema>, string> = {
  brixValue: "brix_value",
  phValue: "ph_value",
  quantity: "quantity",
};

type DraftSummaryRow = {
  id: number;
  draft_id: string;
  date: Date | string | null;
  product_type: string;
  status: string;
  created_by_name: string | null;
  bucket_count: number;
  total_quantity: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type DraftContext = {
  productType: ProductSlug;
  draftTable: string;
  bucketTable: string;
  centerCompletionTable: string;
  row: any;
};

type BucketContext = {
  productType: ProductSlug;
  table: string;
  row: any;
};

const toIsoString = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sortDraftsDesc = (a: DraftSummaryRow, b: DraftSummaryRow) => {
  const dateA = a.date ? new Date(a.date as any).getTime() : 0;
  const dateB = b.date ? new Date(b.date as any).getTime() : 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }
  const createdA = a.created_at ? new Date(a.created_at as any).getTime() : 0;
  const createdB = b.created_at ? new Date(b.created_at as any).getTime() : 0;
  return createdB - createdA;
};

async function fetchDraftSummaries(productType: ProductSlug, statusFilter?: string) {
  const draftsTable = getTableName("drafts", productType);
  const bucketsTable = getTableName("buckets", productType);

  const params: any[] = [];
  const whereClauses: string[] = [];
  if (statusFilter) {
    whereClauses.push(`d.status = $${params.length + 1}`);
    params.push(statusFilter);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    SELECT
      d.id,
      d.draft_id,
      d.date,
      d.product_type,
      d.status,
      u.name AS created_by_name,
      COALESCE(buckets.bucket_count, 0) AS bucket_count,
      COALESCE(buckets.total_quantity, 0) AS total_quantity,
      d.created_at,
      d.updated_at
    FROM ${draftsTable} d
    LEFT JOIN users u ON d.created_by = u.user_id
    LEFT JOIN (
      SELECT draft_id, COUNT(*) AS bucket_count, COALESCE(SUM(quantity), 0) AS total_quantity
      FROM ${bucketsTable}
      GROUP BY draft_id
    ) buckets ON buckets.draft_id = d.id
    ${whereSql}
    ORDER BY d.date DESC, d.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows.map((row) => ({
    ...row,
    product_type: row.product_type ?? productType,
    bucket_count: toNumber(row.bucket_count),
    total_quantity: toNumber(row.total_quantity),
  })) as DraftSummaryRow[];
}

async function resolveDraftContext(draftId: string): Promise<DraftContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const draftsTable = getTableName("drafts", productType);
    const { rows } = await pool.query(
      `SELECT d.*, u.name AS created_by_name FROM ${draftsTable} d LEFT JOIN users u ON d.created_by = u.user_id WHERE d.draft_id = $1`,
      [draftId]
    );
    if (rows.length > 0) {
      return {
        productType,
        draftTable: draftsTable,
        bucketTable: getTableName("buckets", productType),
        centerCompletionTable: getTableName("centerCompletions", productType),
        row: rows[0],
      };
    }
  }
  return null;
}

async function resolveBucketContext(bucketId: string): Promise<BucketContext | null> {
  for (const productType of SUPPORTED_PRODUCTS) {
    const table = getTableName("buckets", productType);
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE bucket_id = $1`, [bucketId]);
    if (rows.length > 0) {
      return { productType, table, row: rows[0] };
    }
  }
  return null;
}

router.get("/drafts", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const productFilter = normalizeProduct(req.query.productType);
    const statusFilter = typeof req.query.status === "string" && req.query.status.trim()
      ? req.query.status.trim().toLowerCase()
      : undefined;

    const productsToQuery = productFilter ? [productFilter] : [...SUPPORTED_PRODUCTS];
    const draftsPerProduct = await Promise.all(productsToQuery.map((product) => fetchDraftSummaries(product, statusFilter)));
    const combined = draftsPerProduct.flat().sort(sortDraftsDesc);
    res.json(combined);
  } catch (error) {
    console.error("Error fetching drafts:", error);
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
});

router.get("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draftRow = context.row;
    const bucketsQuery = `
      SELECT
        b.id,
        b.bucket_id,
        b.product_type,
        b.brix_value,
        b.ph_value,
        b.quantity,
        cc.center_id,
        cc.center_name,
        cc.location
      FROM ${context.bucketTable} b
      JOIN collection_centers cc ON b.collection_center_id = cc.id
      WHERE b.draft_id = $1
      ORDER BY cc.center_name, b.bucket_id
    `;

    const { rows: bucketRows } = await pool.query(bucketsQuery, [draftRow.id]);

    const centers = bucketRows.reduce<Record<string, any>>((acc, bucket) => {
      const key = bucket.center_name as string;
      if (!acc[key]) {
        acc[key] = {
          name: bucket.center_name,
          centerId: bucket.center_id,
          location: bucket.location,
          buckets: [],
        };
      }
      acc[key].buckets.push({
        id: bucket.bucket_id,
        productType: bucket.product_type,
        brixValue: bucket.brix_value,
        phValue: bucket.ph_value,
        quantity: bucket.quantity,
        collectionCenterId: bucket.center_id,
        collectionCenterName: bucket.center_name,
      });
      return acc;
    }, {});

    const response = {
      ...draftRow,
      product_type: draftRow.product_type ?? context.productType,
      created_at: toIsoString(draftRow.created_at),
      updated_at: toIsoString(draftRow.updated_at),
      buckets: Object.values(centers),
      bucketCount: bucketRows.length,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching draft:", error);
    res.status(500).json({ error: "Failed to fetch draft" });
  }
});

router.post("/drafts", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const validated = createDraftSchema.parse(req.body ?? {});
    const user = (req as any).user;

    const productType = normalizeProduct(validated.productType) ?? DEFAULT_PRODUCT;
    const draftTable = getTableName("drafts", productType);
    const draftId = `d${Date.now()}`;
    const dateValue = validated.date ?? new Date().toISOString().split("T")[0];

    const insertQuery = `
      INSERT INTO ${draftTable} (draft_id, date, product_type, status, created_by)
      VALUES ($1, $2, $3, 'draft', $4)
      RETURNING *
    `;

    const { rows } = await pool.query(insertQuery, [draftId, dateValue, productType, user.userId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating draft:", error);
    res.status(500).json({ error: "Failed to create draft" });
  }
});

router.put("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const validated = updateDraftSchema.parse(req.body ?? {});

    if (!validated.status) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const updateQuery = `
      UPDATE ${context.draftTable}
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE draft_id = $2
      RETURNING *
    `;

    const { rows } = await pool.query(updateQuery, [validated.status, draftId]);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating draft:", error);
    res.status(500).json({ error: "Failed to update draft" });
  }
});

router.delete("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    await pool.query(`DELETE FROM ${context.bucketTable} WHERE draft_id = $1`, [context.row.id]);
    await pool.query(`DELETE FROM ${context.centerCompletionTable} WHERE draft_id = $1`, [draftId]);
    const { rows } = await pool.query(`DELETE FROM ${context.draftTable} WHERE draft_id = $1 RETURNING *`, [draftId]);

    res.json({ message: "Draft deleted successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error deleting draft:", error);
    res.status(500).json({ error: "Failed to delete draft" });
  }
});

router.post("/drafts/:draftId/submit", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const { rows } = await pool.query(
      `UPDATE ${context.draftTable} SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE draft_id = $1 RETURNING *`,
      [draftId]
    );
    res.json({ message: "Draft submitted successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error submitting draft:", error);
    res.status(500).json({ error: "Failed to submit draft" });
  }
});

router.post("/drafts/:draftId/reopen", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const { rows } = await pool.query(
      `UPDATE ${context.draftTable} SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE draft_id = $1 RETURNING *`,
      [draftId]
    );
    res.json({ message: "Draft reopened successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error reopening draft:", error);
    res.status(500).json({ error: "Failed to reopen draft" });
  }
});

router.get("/drafts/:draftId/centers/:centerId/buckets", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId, centerId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const query = `
      SELECT
        b.id,
        b.bucket_id,
        b.product_type,
        b.brix_value,
        b.ph_value,
        b.quantity,
        cc.center_name,
        cc.center_id,
        ${context.draftTable}.date AS draft_date
      FROM ${context.bucketTable} b
      JOIN collection_centers cc ON b.collection_center_id = cc.id
      JOIN ${context.draftTable} ON b.draft_id = ${context.draftTable}.id
      WHERE ${context.draftTable}.draft_id = $1 AND (cc.center_id = $2 OR cc.center_name = $2)
      ORDER BY b.bucket_id
    `;

    const { rows } = await pool.query(query, [draftId, centerId]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching buckets:", error);
    res.status(500).json({ error: "Failed to fetch buckets" });
  }
});

router.post("/buckets", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  const client = await pool.connect();
  try {
    const validated = createBucketSchema.parse(req.body ?? {});
    const productType = validated.productType;
    const draftTable = getTableName("drafts", productType);
    const bucketTable = getTableName("buckets", productType);

    const { rows: draftRows } = await client.query(`SELECT id FROM ${draftTable} WHERE draft_id = $1`, [validated.draftId]);
    const draftRow = draftRows[0];
    if (!draftRow) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const centerQuery = `
      SELECT id, center_id FROM collection_centers
      WHERE center_id = $1 OR CAST(id AS TEXT) = $1 OR LOWER(center_name) = LOWER($1)
      LIMIT 1
    `;
    const { rows: centerRows } = await client.query(centerQuery, [validated.collectionCenterId]);
    const centerRow = centerRows[0];
    if (!centerRow) {
      return res.status(400).json({ error: "Invalid collection center ID" });
    }

    const bucketId = `b${Date.now()}`;

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL session_replication_role = replica");
    } catch (err) {
      console.log("Could not disable triggers:", err);
    }

    const insertQuery = `
      INSERT INTO ${bucketTable} (
        bucket_id,
        draft_id,
        collection_center_id,
        product_type,
        brix_value,
        ph_value,
        quantity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const { rows } = await client.query(insertQuery, [
      bucketId,
      draftRow.id,
      centerRow.id,
      productType,
      validated.brixValue ?? null,
      validated.phValue ?? null,
      validated.quantity,
    ]);

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("ROLLBACK FAILED:", rollbackError);
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }

    console.error("Error creating bucket:", error);
    res.status(500).json({ error: "Failed to create bucket" });
  } finally {
    client.release();
  }
});

router.put("/buckets/:bucketId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { bucketId } = req.params;
    const validated = updateBucketSchema.parse(req.body ?? {});

    const context = await resolveBucketContext(bucketId);
    if (!context) {
      return res.status(404).json({ error: "Bucket not found" });
    }

    const fields = Object.entries(validated)
      .filter((entry): entry is [keyof typeof validated, number] => entry[1] !== undefined)
      .map(([key, value], index) => ({
        column: BUCKET_UPDATE_FIELD_MAP[key],
        value,
        index,
      }));

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

  const setClause = fields.map(({ column, index }) => `${column} = $${index + 1}`).join(", ");
    const params: Array<number | string> = fields.map((field) => field.value);
    params.push(bucketId);

    const updateQuery = `
      UPDATE ${context.table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE bucket_id = $${params.length}
      RETURNING *
    `;

    const { rows } = await pool.query(updateQuery, params);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating bucket:", error);
    res.status(500).json({ error: "Failed to update bucket" });
  }
});

router.delete("/buckets/:bucketId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { bucketId } = req.params;
    const context = await resolveBucketContext(bucketId);
    if (!context) {
      return res.status(404).json({ error: "Bucket not found" });
    }

    const { rows } = await pool.query(`DELETE FROM ${context.table} WHERE bucket_id = $1 RETURNING *`, [bucketId]);
    res.json({ message: "Bucket deleted successfully", bucket: rows[0] });
  } catch (error) {
    console.error("Error deleting bucket:", error);
    res.status(500).json({ error: "Failed to delete bucket" });
  }
});

router.get("/centers", auth, requireRole("Field Collection", "Administrator"), async (_req, res) => {
  try {
    const query = `
      SELECT id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at
      FROM collection_centers
      WHERE is_active = true
      ORDER BY center_name
    `;

    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching collection centers:", error);
    res.status(500).json({ error: "Failed to fetch collection centers" });
  }
});

router.post("/drafts/:draftId/centers/:centerId/submit", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId, centerId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const insertQuery = `
      INSERT INTO ${context.centerCompletionTable} (draft_id, center_id, completed_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (draft_id, center_id)
      DO UPDATE SET completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const { rows } = await pool.query(insertQuery, [draftId, centerId]);
    res.json({ message: "Center submitted successfully", completion: rows[0] });
  } catch (error) {
    console.error("Error submitting center:", error);
    res.status(500).json({ error: "Failed to submit center" });
  }
});

router.post("/drafts/:draftId/centers/:centerId/reopen", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId, centerId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const deleteQuery = `
      DELETE FROM ${context.centerCompletionTable}
      WHERE draft_id = $1 AND center_id = $2
      RETURNING *
    `;

    const { rows } = await pool.query(deleteQuery, [draftId, centerId]);
    res.json({ message: "Center reopened successfully", completion: rows[0] ?? null });
  } catch (error) {
    console.error("Error reopening center:", error);
    res.status(500).json({ error: "Failed to reopen center" });
  }
});

router.get("/drafts/:draftId/completed-centers", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const { rows } = await pool.query(`SELECT center_id, completed_at FROM ${context.centerCompletionTable} WHERE draft_id = $1`, [draftId]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching completed centers:", error);
    res.status(500).json({ error: "Failed to fetch completed centers" });
  }
});

export default router;
