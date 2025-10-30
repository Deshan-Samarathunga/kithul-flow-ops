import express from "express";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import { z } from "zod";
import {
  listDrafts as listFieldDrafts,
  getDraft as getFieldDraft,
  createDraft as createFieldDraft,
  updateDraft as updateFieldDraft,
  deleteDraft as deleteFieldDraft,
  listCenters as listFieldCenters,
  submitCenter as submitFieldCenter,
  reopenCenter as reopenFieldCenter,
  getCompletedCenters as getFieldCompletedCenters,
  createBucket as createFieldBucket,
  updateBucket as updateFieldBucket,
  deleteBucket as deleteFieldBucket,
} from "../controllers/fieldCollectionController.js";
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

router.get("/drafts", auth, requireRole("Field Collection", "Administrator"), listFieldDrafts as any);

router.get("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), getFieldDraft as any);

router.post("/drafts", auth, requireRole("Field Collection", "Administrator"), createFieldDraft as any);

router.put("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), updateFieldDraft as any);

router.delete("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), deleteFieldDraft as any);

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

router.post("/buckets", auth, requireRole("Field Collection", "Administrator"), createFieldBucket as any);

router.put("/buckets/:bucketId", auth, requireRole("Field Collection", "Administrator"), updateFieldBucket as any);

router.delete("/buckets/:bucketId", auth, requireRole("Field Collection", "Administrator"), deleteFieldBucket as any);

router.get("/centers", auth, requireRole("Field Collection", "Administrator"), listFieldCenters as any);

router.post("/drafts/:draftId/centers/:centerId/submit", auth, requireRole("Field Collection", "Administrator"), submitFieldCenter as any);

router.post("/drafts/:draftId/centers/:centerId/reopen", auth, requireRole("Field Collection", "Administrator"), reopenFieldCenter as any);

router.get("/drafts/:draftId/completed-centers", auth, requireRole("Field Collection", "Administrator"), getFieldCompletedCenters as any);

export default router;
