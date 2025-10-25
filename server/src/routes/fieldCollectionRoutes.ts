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

const DRAFTS_TABLE = "field_collection_drafts";
const CENTER_COMPLETIONS_TABLE = "field_collection_center_completions";
const BUCKET_TOTALS_SOURCE = SUPPORTED_PRODUCTS.map(
  (product) => `SELECT draft_id, quantity FROM ${getTableName("buckets", product)}`
).join(" UNION ALL ");
const BUCKETS_SOURCE = SUPPORTED_PRODUCTS.map(
  (product) =>
    `SELECT id, bucket_id, draft_id, collection_center_id, product_type, brix_value, ph_value, quantity, created_at, updated_at FROM ${getTableName("buckets", product)}`,
).join(" UNION ALL ");

const createDraftSchema = z.object({
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
  status: string;
  created_by_name: string | null;
  bucket_count: number;
  total_quantity: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
};

type DraftContext = {
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

const ADMIN_ROLE = "administrator";

const normalizeUserId = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const isAdminRole = (role: unknown): boolean => {
  if (typeof role !== "string") {
    return false;
  }
  return role.trim().toLowerCase() === ADMIN_ROLE;
};

const extractUserId = (user: unknown): string | null => {
  if (!user || typeof user !== "object") {
    return null;
  }
  return normalizeUserId((user as Record<string, unknown>).userId);
};

const canAccessDraft = (user: unknown, draftRow: unknown): boolean => {
  if (!draftRow || typeof draftRow !== "object") {
    return false;
  }
  if (user && typeof user === "object" && isAdminRole((user as Record<string, unknown>).role)) {
    return true;
  }

  const userId = extractUserId(user);
  if (!userId) {
    return false;
  }

  const createdBy = normalizeUserId((draftRow as Record<string, unknown>).created_by);
  return Boolean(createdBy && createdBy === userId);
};

async function fetchDraftRowByInternalId(id: unknown): Promise<Record<string, unknown> | null> {
  if (typeof id !== "number" && typeof id !== "string") {
    return null;
  }
  const { rows } = await pool.query(`SELECT * FROM ${DRAFTS_TABLE} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

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

async function fetchDraftSummaries(
  productFilter?: ProductSlug | null,
  statusFilter?: string,
  createdByFilter?: string | null,
) {
  const params: unknown[] = [];
  const whereClauses: string[] = [];

  if (statusFilter) {
    whereClauses.push(`LOWER(d.status) = $${params.length + 1}`);
    params.push(statusFilter);
  }

  if (productFilter) {
    whereClauses.push(`EXISTS (SELECT 1 FROM ${getTableName("buckets", productFilter)} b WHERE b.draft_id = d.id)`);
  }

  if (createdByFilter) {
    whereClauses.push(`d.created_by = $${params.length + 1}`);
    params.push(createdByFilter);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    WITH bucket_totals AS (
      SELECT draft_id, COUNT(*) AS bucket_count, COALESCE(SUM(quantity), 0) AS total_quantity
      FROM (${BUCKET_TOTALS_SOURCE}) AS all_buckets
      GROUP BY draft_id
    )
    SELECT
      d.id,
      d.draft_id,
      d.date,
      d.status,
      u.name AS created_by_name,
      COALESCE(bucket_totals.bucket_count, 0) AS bucket_count,
      COALESCE(bucket_totals.total_quantity, 0) AS total_quantity,
      d.created_at,
      d.updated_at
    FROM ${DRAFTS_TABLE} d
    LEFT JOIN users u ON d.created_by = u.user_id
    LEFT JOIN bucket_totals ON bucket_totals.draft_id = d.id
    ${whereSql}
    ORDER BY d.date DESC, d.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows.map((row) => ({
    ...row,
    bucket_count: toNumber(row.bucket_count),
    total_quantity: toNumber(row.total_quantity),
  })) as DraftSummaryRow[];
}

async function resolveDraftContext(draftId: string): Promise<DraftContext | null> {
  const { rows } = await pool.query(
    `SELECT d.*, u.name AS created_by_name FROM ${DRAFTS_TABLE} d LEFT JOIN users u ON d.created_by = u.user_id WHERE d.draft_id = $1`,
    [draftId],
  );

  if (rows.length === 0) {
    return null;
  }

  return {
    row: rows[0],
  };
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

  const requestUser = (req as any).user;
  const isAdminUser = isAdminRole(requestUser?.role);
  let createdByFilter: string | null = null;

  if (!isAdminUser) {
    createdByFilter = extractUserId(requestUser);
    if (!createdByFilter) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const drafts = await fetchDraftSummaries(productFilter, statusFilter, createdByFilter);
  drafts.sort(sortDraftsDesc);
  res.json(drafts);
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
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
      FROM (${BUCKETS_SOURCE}) b
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
      product_type: null,
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
    const userId = extractUserId(user);

    if (!userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const draftId = `d${Date.now()}`;
    const dateValue = validated.date ?? new Date().toISOString().split("T")[0];

    const { rows: existingDrafts } = await pool.query(
      `SELECT 1 FROM ${DRAFTS_TABLE} WHERE created_by = $1 AND date = $2 LIMIT 1`,
      [userId, dateValue],
    );

    if (existingDrafts.length > 0) {
      return res.status(409).json({ error: "Draft for this date already exists" });
    }

    const insertQuery = `
      INSERT INTO ${DRAFTS_TABLE} (draft_id, date, status, created_by)
      VALUES ($1, $2, 'draft', $3)
      RETURNING *
    `;

    const { rows } = await pool.query(insertQuery, [draftId, dateValue, userId]);
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updateQuery = `
      UPDATE ${DRAFTS_TABLE}
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    for (const product of SUPPORTED_PRODUCTS) {
      await pool.query(`DELETE FROM ${getTableName("buckets", product)} WHERE draft_id = $1`, [context.row.id]);
    }
    await pool.query(`DELETE FROM ${CENTER_COMPLETIONS_TABLE} WHERE draft_id = $1`, [draftId]);
    const { rows } = await pool.query(`DELETE FROM ${DRAFTS_TABLE} WHERE draft_id = $1 RETURNING *`, [draftId]);

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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { rows: centerRows } = await pool.query(
      "SELECT center_id, center_name FROM collection_centers WHERE is_active = true",
    );

    const { rows: completionRows } = await pool.query(
      `SELECT center_id FROM ${CENTER_COMPLETIONS_TABLE} WHERE draft_id = $1`,
      [draftId],
    );

    const completedSet = new Set(
      completionRows
        .map((row) => row.center_id)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    );

    const pendingCenters = centerRows.filter(
      (center) => typeof center.center_id === "string" && !completedSet.has(center.center_id),
    );

    if (pendingCenters.length > 0) {
      return res.status(400).json({
        error: "Submit all centers before completing the draft",
        pendingCenters: pendingCenters.map((center) => ({
          centerId: center.center_id,
          centerName: center.center_name,
        })),
      });
    }

    const { rows } = await pool.query(
      `UPDATE ${DRAFTS_TABLE} SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE draft_id = $1 RETURNING *`,
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { rows } = await pool.query(
      `UPDATE ${DRAFTS_TABLE} SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE draft_id = $1 RETURNING *`,
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
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
        d.date AS draft_date
      FROM (${BUCKETS_SOURCE}) b
      JOIN collection_centers cc ON b.collection_center_id = cc.id
      JOIN ${DRAFTS_TABLE} d ON b.draft_id = d.id
      WHERE d.draft_id = $1 AND (cc.center_id = $2 OR cc.center_name = $2)
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
    const bucketTable = getTableName("buckets", productType);

    const draftContext = await resolveDraftContext(validated.draftId);
    if (!draftContext) {
      return res.status(404).json({ error: "Draft not found" });
    }

    if (!canAccessDraft((req as any).user, draftContext.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const draftRow = draftContext.row;
    const draftInternalId = draftRow?.id;
    if (draftInternalId === null || draftInternalId === undefined) {
      return res.status(400).json({ error: "Draft is missing an internal identifier" });
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
      draftInternalId,
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

    const draftRow = await fetchDraftRowByInternalId(context.row.draft_id);
    if (!draftRow) {
      return res.status(404).json({ error: "Draft not found" });
    }

    if (!canAccessDraft((req as any).user, draftRow)) {
      return res.status(403).json({ error: "Forbidden" });
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

    const draftRow = await fetchDraftRowByInternalId(context.row.draft_id);
    if (!draftRow) {
      return res.status(404).json({ error: "Draft not found" });
    }

    if (!canAccessDraft((req as any).user, draftRow)) {
      return res.status(403).json({ error: "Forbidden" });
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const insertQuery = `
      INSERT INTO ${CENTER_COMPLETIONS_TABLE} (draft_id, center_id, completed_at)
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const deleteQuery = `
      DELETE FROM ${CENTER_COMPLETIONS_TABLE}
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

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

  const { rows } = await pool.query(`SELECT center_id, completed_at FROM ${CENTER_COMPLETIONS_TABLE} WHERE draft_id = $1`, [draftId]);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching completed centers:", error);
    res.status(500).json({ error: "Failed to fetch completed centers" });
  }
});

export default router;
