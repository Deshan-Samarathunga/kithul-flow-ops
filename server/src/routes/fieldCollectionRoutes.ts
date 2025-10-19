import express from "express";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import { z } from "zod";

const router = express.Router();

// Validation schemas
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
  qrCode: z.string().optional(),
  farmerId: z.string().optional(),
  farmerName: z.string().optional(),
  collectionTime: z.string().optional(),
});

// Get all drafts with optional filtering
router.get("/drafts", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { productType, status } = req.query;
    
    let query = `
      SELECT 
        d.id,
        d.draft_id,
        d.date,
        d.product_type,
        d.status,
        u.name as created_by_name,
        COUNT(b.id) as bucket_count,
        COALESCE(SUM(b.quantity), 0) as total_quantity,
        d.created_at,
        d.updated_at
      FROM drafts d
      LEFT JOIN buckets b ON d.id::bigint = b.draft_id
      LEFT JOIN users u ON d.created_by = u.user_id
    `;
    
    const conditions = [];
    const params = [];
    let paramCount = 0;
    
    if (productType) {
      paramCount++;
      conditions.push(`d.product_type = $${paramCount}`);
      params.push(productType);
    }
    
    if (status) {
      paramCount++;
      conditions.push(`d.status = $${paramCount}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    query += `
      GROUP BY d.id, d.draft_id, d.date, d.product_type, d.status, u.name, d.created_at, d.updated_at
      ORDER BY d.date DESC, d.created_at DESC
    `;
    
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching drafts:", error);
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
});

// Get a specific draft by ID
router.get("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const draftQuery = `
      SELECT 
        d.id,
        d.draft_id,
        d.date,
        d.product_type,
        d.status,
        u.name as created_by_name,
        d.created_at,
        d.updated_at
      FROM drafts d
      LEFT JOIN users u ON d.created_by = u.user_id
      WHERE d.draft_id = $1
    `;
    
    const { rows: draftRows } = await pool.query(draftQuery, [draftId]);
    
    if (draftRows.length === 0) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    const draft = draftRows[0];
    
    // Get buckets for this draft grouped by center
    const bucketsQuery = `
      SELECT 
        b.id,
        b.bucket_id,
        b.product_type,
        b.brix_value,
        b.ph_value,
        b.quantity,
        b.field_collector_id,
        u.name as field_collector_name,
        cc.center_id,
        cc.center_name,
        cc.location
      FROM buckets b
      JOIN collection_centers cc ON b.collection_center_id = cc.id
      LEFT JOIN users u ON b.field_collector_id = u.user_id
      WHERE b.draft_id = $1::bigint
      ORDER BY cc.center_name, b.bucket_id
    `;
    
    const { rows: bucketRows } = await pool.query(bucketsQuery, [draft.id]);
    
    // Group buckets by center
    const centers = bucketRows.reduce((acc: any, bucket) => {
      const centerKey = bucket.center_name;
      if (!acc[centerKey]) {
        acc[centerKey] = {
          name: bucket.center_name,
          centerId: bucket.center_id,
          location: bucket.location,
          buckets: []
        };
      }
      acc[centerKey].buckets.push({
        id: bucket.bucket_id,
        productType: bucket.product_type,
        brixValue: bucket.brix_value,
        phValue: bucket.ph_value,
        quantity: bucket.quantity,
        fieldCollectorId: bucket.field_collector_id,
        fieldCollectorName: bucket.field_collector_name,
        collectionCenterId: bucket.center_id,
        collectionCenterName: bucket.center_name
      });
      return acc;
    }, {});
    
    draft.buckets = Object.values(centers);
    draft.bucketCount = bucketRows.length;
    
    res.json(draft);
  } catch (error) {
    console.error("Error fetching draft:", error);
    res.status(500).json({ error: "Failed to fetch draft" });
  }
});

// Create a new draft
router.post("/drafts", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const validatedData = createDraftSchema.parse(req.body);
    const user = (req as any).user;
    
    const draftId = `d${Date.now()}`;
    const date = validatedData.date || new Date().toISOString().split('T')[0];
    
    const query = `
      INSERT INTO drafts (draft_id, date, product_type, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [
      draftId,
      date,
      validatedData.productType || 'sap', // Default to sap if not provided
      user.userId // Use userId (string) instead of id (integer)
    ]);
    
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error creating draft:", error);
    res.status(500).json({ error: "Failed to create draft" });
  }
});

// Update a draft
router.put("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    const validatedData = updateDraftSchema.parse(req.body);
    
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    if (validatedData.status !== undefined) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      params.push(validatedData.status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    paramCount++;
    params.push(draftId);
    
    const query = `
      UPDATE drafts 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE draft_id = $${paramCount}
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating draft:", error);
    res.status(500).json({ error: "Failed to update draft" });
  }
});

// Delete a draft
router.delete("/drafts/:draftId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    
    // First, delete all buckets associated with this draft
    await pool.query("DELETE FROM buckets WHERE draft_id = (SELECT id FROM drafts WHERE draft_id = $1)", [draftId]);
    
    // Then delete the draft itself
    const { rows } = await pool.query(
      "DELETE FROM drafts WHERE draft_id = $1 RETURNING *",
      [draftId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    res.json({ message: "Draft deleted successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error deleting draft:", error);
    res.status(500).json({ error: "Failed to delete draft" });
  }
});

// Submit a draft (move from draft to submitted)
router.post("/drafts/:draftId/submit", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const { rows } = await pool.query(
      "UPDATE drafts SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE draft_id = $1 RETURNING *",
      [draftId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    res.json({ message: "Draft submitted successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error submitting draft:", error);
    res.status(500).json({ error: "Failed to submit draft" });
  }
});

// Reopen a draft (move from submitted back to draft)
router.post("/drafts/:draftId/reopen", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const { rows } = await pool.query(
      "UPDATE drafts SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE draft_id = $1 RETURNING *",
      [draftId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Draft not found" });
    }
    
    res.json({ message: "Draft reopened successfully", draft: rows[0] });
  } catch (error) {
    console.error("Error reopening draft:", error);
    res.status(500).json({ error: "Failed to reopen draft" });
  }
});

// Get buckets for a specific draft and center
router.get("/drafts/:draftId/centers/:centerId/buckets", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId, centerId } = req.params;
    
    const query = `
      SELECT 
        b.id,
        b.bucket_id,
        b.product_type,
        b.brix_value,
        b.ph_value,
        b.quantity,
        b.field_collector_id,
        u.name as field_collector_name,
        cc.center_name,
        d.date as draft_date
      FROM buckets b
      JOIN collection_centers cc ON b.collection_center_id = cc.id
      JOIN drafts d ON b.draft_id = d.id::bigint
      LEFT JOIN users u ON b.field_collector_id = u.user_id
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

// Create a new bucket
router.post("/buckets", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  const client = await pool.connect();
  try {
    const validatedData = createBucketSchema.parse(req.body);
    const user = (req as any).user;

    const draftResult = await client.query<{ id: string }>("SELECT id FROM drafts WHERE draft_id = $1", [
      validatedData.draftId,
    ]);
    const draftRow = draftResult.rows[0];
    if (!draftRow) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const centerResult = await client.query<{ id: number; center_id: string }>(
      `SELECT id, center_id FROM collection_centers
         WHERE center_id = $1
            OR CAST(id AS TEXT) = $1
            OR LOWER(center_name) = LOWER($1)
         LIMIT 1`,
      [validatedData.collectionCenterId]
    );
    const centerRow = centerResult.rows[0];
    if (!centerRow) {
      return res.status(400).json({ error: "Invalid collection center ID" });
    }

    const bucketId = `b${Date.now()}`;

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL session_replication_role = replica");
    } catch (triggerError) {
      console.log("Could not disable triggers:", triggerError);
    }

    const insertResult = await client.query(
      `
        INSERT INTO buckets (
          bucket_id,
          draft_id,
          collection_center_id,
          product_type,
          brix_value,
          ph_value,
          quantity,
          field_collector_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        bucketId,
        draftRow.id,
        centerRow.id,
        validatedData.productType,
        validatedData.brixValue ?? null,
        validatedData.phValue ?? null,
        validatedData.quantity,
        user.userId, // Add field collector tracking
      ]
    );

    await client.query("COMMIT");
    res.status(201).json(insertResult.rows[0]);
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

    if (error instanceof Error && error.message.includes("total_amount")) {
      console.error(
        "TRIGGER ERROR DETECTED: The database trigger is still active and trying to access removed columns."
      );
      console.error("Please run the SQL script in db/007_force_remove_triggers.sql to fix this issue.");
      return res.status(500).json({
        error: "Database trigger error",
        details:
          "The calculate_total_amount trigger is still active. Please contact your database administrator to run the trigger removal script.",
        fix: "Run the SQL commands in db/007_force_remove_triggers.sql in your PostgreSQL client",
      });
    }

    res.status(500).json({ error: "Failed to create bucket" });
  } finally {
    client.release();
  }
});

// Update a bucket
router.put("/buckets/:bucketId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { bucketId } = req.params;
    const validatedData = updateBucketSchema.parse(req.body);
    
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;
    
    // Map camelCase to snake_case for database columns
    const fieldMapping: Record<string, string> = {
      brixValue: 'brix_value',
      phValue: 'ph_value',
      qrCode: 'qr_code',
      farmerId: 'farmer_id',
      farmerName: 'farmer_name',
      collectionTime: 'collection_time'
    };

    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        const dbField = fieldMapping[key] || key;
        updateFields.push(`${dbField} = $${paramCount}`);
        params.push(value);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    paramCount++;
    params.push(bucketId);
    
    const query = `
      UPDATE buckets 
      SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE bucket_id = $${paramCount}
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Bucket not found" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Error updating bucket:", error);
    res.status(500).json({ error: "Failed to update bucket" });
  }
});

// Delete a bucket
router.delete("/buckets/:bucketId", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { bucketId } = req.params;
    
    const { rows } = await pool.query(
      "DELETE FROM buckets WHERE bucket_id = $1 RETURNING *",
      [bucketId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Bucket not found" });
    }
    
    res.json({ message: "Bucket deleted successfully", bucket: rows[0] });
  } catch (error) {
    console.error("Error deleting bucket:", error);
    res.status(500).json({ error: "Failed to delete bucket" });
  }
});

// Get all collection centers
router.get("/centers", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        center_id,
        center_name,
        location,
        center_agent,
        contact_phone,
        is_active,
        created_at,
        updated_at
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

// Get all field collectors
router.get("/field-collectors", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const query = `
      SELECT 
        user_id,
        name,
        role,
        created_at
      FROM users
      WHERE role = 'Field Collection'
      ORDER BY name
    `;
    
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching field collectors:", error);
    res.status(500).json({ error: "Failed to fetch field collectors" });
  }
});

// Submit a center (mark as completed)
router.post("/drafts/:draftId/centers/:centerId/submit", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId, centerId } = req.params;
    
    // Insert center completion record
    const { rows } = await pool.query(
      `INSERT INTO center_completions (draft_id, center_id, completed_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP) 
       ON CONFLICT (draft_id, center_id) 
       DO UPDATE SET completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [draftId, centerId]
    );
    
    res.json({ message: "Center submitted successfully", completion: rows[0] });
  } catch (error) {
    console.error("Error submitting center:", error);
    res.status(500).json({ error: "Failed to submit center" });
  }
});

// Reopen a center (mark as not completed)
router.post("/drafts/:draftId/centers/:centerId/reopen", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId, centerId } = req.params;
    
    // Remove center completion record
    const { rows } = await pool.query(
      "DELETE FROM center_completions WHERE draft_id = $1 AND center_id = $2 RETURNING *",
      [draftId, centerId]
    );
    
    res.json({ message: "Center reopened successfully", completion: rows[0] });
  } catch (error) {
    console.error("Error reopening center:", error);
    res.status(500).json({ error: "Failed to reopen center" });
  }
});

// Get completed centers for a draft
router.get("/drafts/:draftId/completed-centers", auth, requireRole("Field Collection", "Administrator"), async (req, res) => {
  try {
    const { draftId } = req.params;
    
    const { rows } = await pool.query(
      `SELECT center_id, completed_at 
       FROM center_completions 
       WHERE draft_id = $1`,
      [draftId]
    );
    
    res.json(rows);
  } catch (error) {
    console.error("Error fetching completed centers:", error);
    res.status(500).json({ error: "Failed to fetch completed centers" });
  }
});

export default router;
