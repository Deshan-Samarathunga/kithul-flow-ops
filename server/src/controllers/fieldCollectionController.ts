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
  resolveDraftContext as svcResolveDraftContext,
  fetchDraftRowByInternalId as svcFetchDraftRowByInternalId,
  resolveCanContext as svcResolveCanContext,
} from "../services/fieldCollectionService.js";

const DRAFTS_TABLE = "field_collection_drafts";
const CENTER_COMPLETIONS_TABLE = "field_collection_center_completions";
const CAN_TOTALS_SOURCE = SUPPORTED_PRODUCTS.map(
  (product) => `SELECT draft_id, quantity FROM ${getTableName("cans", product)}`,
).join(" UNION ALL ");
const CANS_SOURCE = SUPPORTED_PRODUCTS.map(
  (product) =>
    `SELECT id, can_id, draft_id, collection_center_id, product_type, brix_value, ph_value, quantity, created_at, updated_at FROM ${getTableName("cans", product)}`,
).join(" UNION ALL ");

const createDraftSchema = z.object({
  date: z.string().optional(),
});

const updateDraftSchema = z.object({
  status: z.enum(["draft", "submitted", "completed"]).optional(),
});

const createCanSchema = z.object({
  draftId: z.string(),
  collectionCenterId: z.string(),
  productType: z.enum(["sap", "treacle"]),
  // Either provide a full canId in the <PRD>-######## format (SAP-######## or TCL-########) or provide a numeric serialNumber (8 digits)
  canId: z.string().trim().min(1).optional(),
  serialNumber: z
    .string()
    .regex(/^\d{1,8}$/)
    .optional(),
  brixValue: z.number().min(0).max(100).optional(),
  phValue: z.number().min(0).max(14).optional(),
  quantity: z.number().positive(),
});

const updateCanSchema = z.object({
  brixValue: z.number().min(0).max(100).optional(),
  phValue: z.number().min(0).max(14).optional(),
  quantity: z.number().positive().optional(),
});

const CAN_UPDATE_FIELD_MAP: Record<keyof z.infer<typeof updateCanSchema>, string> = {
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
  can_count: number;
  total_quantity: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
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
  return svcFetchDraftRowByInternalId(id) as any;
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
    whereClauses.push(
      `EXISTS (SELECT 1 FROM ${getTableName("cans", productFilter)} b WHERE b.draft_id = d.id)`,
    );
  }

  if (createdByFilter) {
    whereClauses.push(`d.created_by = $${params.length + 1}`);
    params.push(createdByFilter);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    WITH can_totals AS (
      SELECT draft_id, COUNT(*) AS can_count, COALESCE(SUM(quantity), 0) AS total_quantity
      FROM (${CAN_TOTALS_SOURCE}) AS all_cans
      GROUP BY draft_id
    )
    SELECT
      d.id,
      d.draft_id,
      d.date,
      d.status,
      u.name AS created_by_name,
      COALESCE(can_totals.can_count, 0) AS can_count,
      COALESCE(can_totals.total_quantity, 0) AS total_quantity,
      d.created_at,
      d.updated_at
    FROM ${DRAFTS_TABLE} d
    LEFT JOIN users u ON d.created_by = u.user_id
    LEFT JOIN can_totals ON can_totals.draft_id = d.id
    ${whereSql}
    ORDER BY d.date DESC, d.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows.map((row) => ({
    ...row,
    can_count: toNumber(row.can_count),
    total_quantity: toNumber(row.total_quantity),
  })) as DraftSummaryRow[];
}

async function resolveDraftContext(draftId: string) {
  return svcResolveDraftContext(draftId) as any;
}

export async function listDrafts(req: Request, res: Response) {
  try {
    const productFilter = normalizeProduct(req.query.productType);
    const statusFilter =
      typeof req.query.status === "string" && (req.query.status as string).trim()
        ? (req.query.status as string).trim().toLowerCase()
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
}

export async function getDraft(req: Request, res: Response) {
  try {
    const { draftId } = req.params as { draftId: string };
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const draftRow = context.row;
    const cansQuery = `
      SELECT
        b.id,
        b.can_id,
        b.product_type,
        b.brix_value,
        b.ph_value,
        b.quantity,
        cc.center_id,
        cc.center_name,
        cc.location
      FROM (${CANS_SOURCE}) b
      JOIN collection_centers cc ON b.collection_center_id = cc.id
      WHERE b.draft_id = $1
      ORDER BY cc.center_name, b.can_id
    `;

    const { rows: canRows } = await pool.query(cansQuery, [draftRow.id]);

    const centers = canRows.reduce<Record<string, any>>((acc, can) => {
      const key = can.center_name as string;
      if (!acc[key]) {
        acc[key] = {
          name: can.center_name,
          centerId: can.center_id,
          location: can.location,
          cans: [],
        };
      }
      acc[key].cans.push({
        id: can.can_id,
        productType: can.product_type,
        brixValue: can.brix_value,
        phValue: can.ph_value,
        quantity: can.quantity,
        collectionCenterId: can.center_id,
        collectionCenterName: can.center_name,
      });
      return acc;
    }, {});

    const response = {
      ...draftRow,
      product_type: null,
      created_at: toIsoString(draftRow.created_at),
      updated_at: toIsoString(draftRow.updated_at),
      cans: Object.values(centers),
      canCount: canRows.length,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching draft:", error);
    res.status(500).json({ error: "Failed to fetch draft" });
  }
}

export async function createDraft(req: Request, res: Response) {
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
}

export async function updateDraft(req: Request, res: Response) {
  try {
    const { draftId } = req.params as { draftId: string };
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

    // Hardening: prevent saving a draft when no centers have been submitted
    if (validated.status === "draft") {
      const { rows: completionRows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM ${CENTER_COMPLETIONS_TABLE} WHERE draft_id = $1`,
        [draftId],
      );
      const completedCount = (completionRows?.[0]?.cnt ?? 0) as number;
      if (completedCount < 1) {
        return res
          .status(400)
          .json({ error: "At least one center must be submitted before saving the draft" });
      }
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
}

export async function deleteDraft(req: Request, res: Response) {
  try {
    const { draftId } = req.params as { draftId: string };
    const context = await resolveDraftContext(draftId);
    if (!context) {
      return res.status(404).json({ error: "Draft not found" });
    }

    if (!canAccessDraft((req as any).user, context.row)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    for (const product of SUPPORTED_PRODUCTS) {
      await pool.query(`DELETE FROM ${getTableName("cans", product)} WHERE draft_id = $1`, [
        context.row.id,
      ]);
    }
    await pool.query(`DELETE FROM ${CENTER_COMPLETIONS_TABLE} WHERE draft_id = $1`, [draftId]);
    const { rows } = await pool.query(
      `DELETE FROM ${DRAFTS_TABLE} WHERE draft_id = $1 RETURNING *`,
      [draftId],
    );

    res.json({ message: "Draft deleted successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error deleting draft:", error);
    res.status(500).json({ error: "Failed to delete draft" });
  }
}

async function resolveCanContext(canId: string) {
  return svcResolveCanContext(canId) as any;
}

export async function listCenters(_req: Request, res: Response) {
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
}

export async function submitCenter(req: Request, res: Response) {
  try {
    const { draftId, centerId } = req.params as { draftId: string; centerId: string };
    const context = await resolveDraftContext(draftId);
    if (!context) return res.status(404).json({ error: "Draft not found" });
    if (!canAccessDraft((req as any).user, context.row))
      return res.status(403).json({ error: "Forbidden" });

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
}

export async function reopenCenter(req: Request, res: Response) {
  try {
    const { draftId, centerId } = req.params as { draftId: string; centerId: string };
    const context = await (async (id: string) =>
      await (async function resolveDraftContext(draftId: string) {
        const { rows } = await pool.query(
          `SELECT d.*, u.name AS created_by_name FROM ${DRAFTS_TABLE} d LEFT JOIN users u ON d.created_by = u.user_id WHERE d.draft_id = $1`,
          [draftId],
        );
        if (rows.length === 0) return null;
        return { row: rows[0] };
      })(id))(draftId);
    if (!context) return res.status(404).json({ error: "Draft not found" });
    if (!canAccessDraft((req as any).user, context.row))
      return res.status(403).json({ error: "Forbidden" });

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
}

export async function getCompletedCenters(req: Request, res: Response) {
  try {
    const { draftId } = req.params as { draftId: string };
    const context = await (async (id: string) =>
      await (async function resolveDraftContext(draftId: string) {
        const { rows } = await pool.query(
          `SELECT d.*, u.name AS created_by_name FROM ${DRAFTS_TABLE} d LEFT JOIN users u ON d.created_by = u.user_id WHERE d.draft_id = $1`,
          [draftId],
        );
        if (rows.length === 0) return null;
        return { row: rows[0] };
      })(id))(draftId);
    if (!context) return res.status(404).json({ error: "Draft not found" });
    if (!canAccessDraft((req as any).user, context.row))
      return res.status(403).json({ error: "Forbidden" });

    const { rows } = await pool.query(
      `SELECT center_id, completed_at FROM ${CENTER_COMPLETIONS_TABLE} WHERE draft_id = $1`,
      [draftId],
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching completed centers:", error);
    res.status(500).json({ error: "Failed to fetch completed centers" });
  }
}

export async function createCan(req: Request, res: Response) {
  const client = await pool.connect();
  let canTable: string | undefined;
  let productType: string | undefined;
  let validated: z.infer<typeof createCanSchema> | undefined;
  try {
    validated = createCanSchema.parse(req.body ?? {});
    productType = validated.productType;
    // Map field collection product types to processing product types for table lookup
    // "sap" -> "treacle" (sap_cans are processed to treacle)
    // "treacle" -> "jaggery" (treacle_cans are processed to jaggery)
    const processingProductType: ProductSlug = productType === "sap" ? "treacle" : "jaggery";
    canTable = getTableName("cans", processingProductType);

    console.log(
      `Creating can: productType=${productType}, processingProductType=${processingProductType}, canTable=${canTable}`,
    );

    const ctx = await resolveDraftContext(validated.draftId);
    if (!ctx) return res.status(404).json({ error: "Draft not found" });
    if (!canAccessDraft((req as any).user, ctx.row))
      return res.status(403).json({ error: "Forbidden" });

    const draftRow = ctx.row;
    const draftInternalId = (draftRow as any)?.id;
    if (draftInternalId === null || draftInternalId === undefined) {
      return res.status(400).json({ error: "Draft is missing an internal identifier" });
    }

    // Try to find collection center by center_id, numeric id, or name
    const centerQuery = `
      SELECT id, center_id, center_name FROM collection_centers
      WHERE is_active = true 
        AND (
          center_id = $1 
          OR CAST(id AS TEXT) = $1 
          OR LOWER(TRIM(center_name)) = LOWER(TRIM($1))
          OR LOWER(TRIM(center_name)) LIKE LOWER(TRIM($1)) || '%'
        )
      LIMIT 1
    `;
    const { rows: centerRows } = await client.query(centerQuery, [validated.collectionCenterId]);
    const centerRow = centerRows[0];
    if (!centerRow) {
      // Log available centers for debugging
      const { rows: allCenters } = await client.query(
        `SELECT id, center_id, center_name, is_active FROM collection_centers LIMIT 10`,
      );
      console.error(`Collection center not found for ID: ${validated.collectionCenterId}`);
      console.error(
        `Available centers:`,
        allCenters.map((c) => ({
          id: c.id,
          center_id: c.center_id,
          name: c.center_name,
          active: c.is_active,
        })),
      );
      return res
        .status(400)
        .json({ error: `Invalid collection center ID: ${validated.collectionCenterId}` });
    }

    // Build/validate can id
    const prefix = productType === "sap" ? "SAP-" : "TCL-";
    let canId = (validated.canId ?? "").trim();

    if (!canId) {
      if (!validated.serialNumber) {
        return res
          .status(400)
          .json({ error: "Either canId or serialNumber (8 digits) is required" });
      }
      const padded = String(validated.serialNumber).padStart(8, "0");
      canId = `${prefix}${padded}`;
    }

    const pattern = productType === "sap" ? /^SAP-\d{8}$/ : /^TCL-\d{8}$/;
    if (!pattern.test(canId)) {
      return res.status(400).json({ error: `Invalid can ID format. Expected ${prefix}########` });
    }

    // Enforce uniqueness
    const { rows: existingCans } = await client.query(
      `SELECT 1 FROM ${canTable} WHERE can_id = $1 LIMIT 1`,
      [canId],
    );
    if (existingCans.length > 0) {
      return res.status(409).json({ error: "Can ID already exists" });
    }

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL session_replication_role = replica");
    } catch {}

    const insertQuery = `
      INSERT INTO ${canTable} (
        can_id,
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
      canId,
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
    } catch {}
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating can:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", {
      errorMessage,
      errorStack,
      productType: productType || "unknown",
      canTable: canTable || "unknown",
      validatedData: validated
        ? {
            draftId: validated.draftId,
            collectionCenterId: validated.collectionCenterId,
            productType: validated.productType,
          }
        : "validation failed",
    });
    res.status(500).json({ error: "Failed to create can", details: errorMessage });
  } finally {
    client.release();
  }
}

export async function updateCan(req: Request, res: Response) {
  try {
    const { canId } = req.params as { canId: string };
    const validated = updateCanSchema.parse(req.body ?? {});

    const context = await resolveCanContext(canId);
    if (!context) return res.status(404).json({ error: "Can not found" });

    const draftRow = await fetchDraftRowByInternalId((context.row as any).draft_id);
    if (!draftRow) return res.status(404).json({ error: "Draft not found" });
    if (!canAccessDraft((req as any).user, draftRow))
      return res.status(403).json({ error: "Forbidden" });

    const fields = Object.entries(validated)
      .filter((entry): entry is [keyof typeof validated, number] => entry[1] !== undefined)
      .map(([key, value], index) => ({
        column: CAN_UPDATE_FIELD_MAP[key as keyof typeof validated],
        value,
        index,
      }));
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

    const setClause = fields.map(({ column, index }) => `${column} = $${index + 1}`).join(", ");
    const params: Array<number | string> = fields.map((field) => field.value as number);
    params.push(canId);

    const updateQuery = `
      UPDATE ${context.table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE can_id = $${params.length}
      RETURNING *
    `;

    const { rows } = await pool.query(updateQuery, params);
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating can:", error);
    res.status(500).json({ error: "Failed to update can" });
  }
}

export async function deleteCan(req: Request, res: Response) {
  try {
    const { canId } = req.params as { canId: string };
    const context = await resolveCanContext(canId);
    if (!context) return res.status(404).json({ error: "Can not found" });

    const draftRow = await fetchDraftRowByInternalId((context.row as any).draft_id);
    if (!draftRow) return res.status(404).json({ error: "Draft not found" });
    if (!canAccessDraft((req as any).user, draftRow))
      return res.status(403).json({ error: "Forbidden" });

    const { rows } = await pool.query(
      `DELETE FROM ${context.table} WHERE can_id = $1 RETURNING *`,
      [canId],
    );
    res.json({ message: "Can deleted successfully", can: rows[0] });
  } catch (error) {
    console.error("Error deleting can:", error);
    res.status(500).json({ error: "Failed to delete can" });
  }
}
