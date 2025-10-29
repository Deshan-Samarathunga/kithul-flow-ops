import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import { auth, requireRole, JwtUser } from "../middleware/authMiddleware.js";
import { normalizeRole, isAllowedRole, ROLE_LIST } from "../roles.js";
import { recordRoleAudit } from "../audit.js";

const router = Router();

router.use(auth, requireRole("Administrator"));

const userIdRegex = /^[a-zA-Z0-9_.-]+$/;

const createUserSchema = z
  .object({
    userId: z
      .string()
      .min(3)
      .max(40)
      .regex(userIdRegex, "User ID may only contain letters, numbers, dots, hyphens, and underscores")
      .transform((s) => s.trim()),
    password: z.string().min(8),
    name: z
      .string()
      .min(1, "Name is required")
      .max(120)
      .transform((s) => s.trim()),
    role: z.string(),
  })
  .transform(({ name, ...rest }) => ({
    ...rest,
    name: name?.length ? name : undefined,
  }));

const updateUserSchema = z
  .object({
    name: z
      .string()
      .max(120)
      .transform((s) => s.trim())
      .optional(),
    role: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided",
  });

const createCenterSchema = z.object({
  centerId: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, "Center ID may only contain letters, numbers, hyphens, and underscores")
    .transform((s) => s.trim()),
  centerName: z
    .string()
    .min(2)
    .max(100)
    .transform((s) => s.trim()),
  location: z
    .string()
    .min(2)
    .max(100)
    .transform((s) => s.trim()),
  centerAgent: z
    .string()
    .min(2)
    .max(100)
    .transform((s) => s.trim()),
  contactPhone: z
    .string()
    .max(20)
    .optional()
    .transform((s) => s?.trim() || null),
});

const updateCenterSchema = z
  .object({
    centerName: z
      .string()
      .min(2)
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    location: z
      .string()
      .min(2)
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    centerAgent: z
      .string()
      .min(2)
      .max(100)
      .transform((s) => s.trim())
      .optional(),
    contactPhone: z
      .string()
      .max(20)
      .optional()
      .transform((s) => s?.trim() || null),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No changes provided",
  });

const toClientUser = (row: any) =>
  row && {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    isActive: true,
    createdAt: row.created_at,
    profileImage: row.profile_image ?? null,
  };

const toClientCenter = (row: any) =>
  row && {
    id: row.id,
    centerId: row.center_id,
    centerName: row.center_name,
    location: row.location,
    centerAgent: row.center_agent,
    contactPhone: row.contact_phone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

router.get("/roles", (_req, res) => {
  res.json({ roles: ROLE_LIST });
});

router.get("/users", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, name, role, profile_image, created_at
         FROM public.users
        WHERE role <> 'Administrator'
        ORDER BY created_at DESC`
    );
    res.json({ users: rows.map(toClientUser) });
  } catch (error) {
    console.error("ADMIN LIST USERS ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/users/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, name, role, profile_image, created_at
         FROM public.users
        WHERE id = $1`,
      [userId]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "Administrator") {
      return res.status(403).json({ error: "Cannot load administrator via this endpoint" });
    }
    res.json(toClientUser(user));
  } catch (error) {
    console.error("ADMIN GET USER ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { userId, password, name, role } = parsed.data;

  const normalizedRole = normalizeRole(role);
  if (!normalizedRole || !isAllowedRole(normalizedRole) || normalizedRole === "Administrator") {
    return res.status(400).json({ error: "Unsupported role" });
  }

  const actor = (req as any).user as JwtUser;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO public.users (
         user_id,
         password_hash,
         name,
         role
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, role, created_at, profile_image`,
      [userId, passwordHash, name ?? null, normalizedRole]
    );

    const created = rows[0];
    res.status(201).json(toClientUser(created));

    recordRoleAudit({
      event: "admin_user_create",
      actorId: actor?.id,
      actorUserId: actor?.userId,
      targetId: created.id,
      targetUserId: created.user_id,
      newRole: created.role,
      metadata: { createdBy: "admin_portal" },
    }).catch((err) => console.error("audit log failed (admin user create)", err));
  } catch (error: any) {
    if (error?.code === "23505" && error.constraint?.includes("user_id")) {
      return res.status(409).json({ error: "User ID already exists" });
    }
    console.error("ADMIN USER CREATE ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/users/:userId", async (req, res) => {
  const parsed = updateUserSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const actor = (req as any).user as JwtUser;

  try {
    const { rows: existingRows } = await pool.query(
      `SELECT id, user_id, name, role, profile_image
         FROM public.users WHERE id = $1`,
      [userId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === "Administrator") {
      return res.status(403).json({ error: "Cannot modify administrator accounts" });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let updatedRole = existing.role;
    let roleChanged = false;

    if (parsed.data.name !== undefined) {
      const nameValue = parsed.data.name?.length ? parsed.data.name : null;
      updates.push(`name = $${updates.length + 1}`);
      params.push(nameValue);
    }

    if (parsed.data.role !== undefined) {
      const normalizedRole = normalizeRole(parsed.data.role);
      if (!normalizedRole || !isAllowedRole(normalizedRole) || normalizedRole === "Administrator") {
        return res.status(400).json({ error: "Unsupported role" });
      }
      if (normalizedRole !== existing.role) {
        updates.push(`role = $${updates.length + 1}`);
        params.push(normalizedRole);
        updatedRole = normalizedRole;
        roleChanged = true;
      }
    }

    if (parsed.data.isActive !== undefined) {
      params.push(parsed.data.isActive);
    }

    if (updates.length === 0) {
      return res.json(toClientUser(existing));
    }

    params.push(userId);

    const { rows } = await pool.query(
      `UPDATE public.users
          SET ${updates.join(", ")}
        WHERE id = $${params.length}
        RETURNING id, user_id, name, role, created_at, profile_image`,
      params
    );
    const updated = rows[0];

    if (roleChanged) {
      recordRoleAudit({
        event: "admin_role_change",
        actorId: actor?.id,
        actorUserId: actor?.userId,
        targetId: updated.id,
        targetUserId: updated.user_id,
        previousRole: existing.role,
        newRole: updated.role,
      }).catch((err) => console.error("audit log failed (admin role change)", err));
    }

    res.json(toClientUser(updated));
  } catch (error) {
    console.error("ADMIN USER UPDATE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:userId", async (req, res) => {
  const targetId = Number(req.params.userId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const actor = (req as any).user as JwtUser;

  if (actor?.id === targetId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, role FROM public.users WHERE id = $1`,
      [targetId]
    );
    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === "Administrator") {
      return res.status(403).json({ error: "Cannot delete administrator accounts" });
    }

    await pool.query(`DELETE FROM public.users WHERE id = $1`, [targetId]);

    recordRoleAudit({
      event: "admin_user_delete",
      actorId: actor?.id,
      actorUserId: actor?.userId,
      targetId: existing.id,
      targetUserId: existing.user_id,
      previousRole: existing.role,
    }).catch((err) => console.error("audit log failed (admin user delete)", err));

    res.status(204).send();
  } catch (error) {
    console.error("ADMIN USER DELETE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Collection Centers Management
router.get("/centers", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at
       FROM collection_centers
       ORDER BY center_name`
    );
    res.json({ centers: rows.map(toClientCenter) });
  } catch (error) {
    console.error("ADMIN LIST CENTERS ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/centers/:centerId", async (req, res) => {
  const centerId = Number(req.params.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    return res.status(400).json({ error: "Invalid center id" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at
       FROM collection_centers
       WHERE id = $1`,
      [centerId]
    );
    const center = rows[0];
    if (!center) return res.status(404).json({ error: "Center not found" });
    res.json(toClientCenter(center));
  } catch (error) {
    console.error("ADMIN GET CENTER ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/centers", async (req, res) => {
  const parsed = createCenterSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { centerId, centerName, location, centerAgent, contactPhone } = parsed.data;

  try {
    const { rows } = await pool.query(
      `INSERT INTO collection_centers (
         center_id,
         center_name,
         location,
         center_agent,
         contact_phone
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at`,
      [centerId, centerName, location, centerAgent, contactPhone]
    );

    const created = rows[0];
    res.status(201).json(toClientCenter(created));
  } catch (error: any) {
    if (error?.code === "23505" && error.constraint?.includes("center_id")) {
      return res.status(409).json({ error: "Center ID already exists" });
    }
    console.error("ADMIN CENTER CREATE ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/centers/:centerId", async (req, res) => {
  const parsed = updateCenterSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const centerId = Number(req.params.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    return res.status(400).json({ error: "Invalid center id" });
  }

  try {
    const { rows: existingRows } = await pool.query(
      `SELECT id, center_id, center_name, location, center_agent, contact_phone, is_active
       FROM collection_centers WHERE id = $1`,
      [centerId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "Center not found" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (parsed.data.centerName !== undefined) {
      updates.push(`center_name = $${updates.length + 1}`);
      params.push(parsed.data.centerName);
    }

    if (parsed.data.location !== undefined) {
      updates.push(`location = $${updates.length + 1}`);
      params.push(parsed.data.location);
    }

    if (parsed.data.centerAgent !== undefined) {
      updates.push(`center_agent = $${updates.length + 1}`);
      params.push(parsed.data.centerAgent);
    }

    if (parsed.data.contactPhone !== undefined) {
      updates.push(`contact_phone = $${updates.length + 1}`);
      params.push(parsed.data.contactPhone);
    }

    if (parsed.data.isActive !== undefined) {
      updates.push(`is_active = $${updates.length + 1}`);
      params.push(parsed.data.isActive);
    }

    if (updates.length === 0) {
      return res.json(toClientCenter(existing));
    }

    params.push(centerId);

    const { rows } = await pool.query(
      `UPDATE collection_centers
       SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${params.length}
       RETURNING id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at`,
      params
    );
    const updated = rows[0];

    res.json(toClientCenter(updated));
  } catch (error) {
    console.error("ADMIN CENTER UPDATE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/centers/:centerId", async (req, res) => {
  const centerId = Number(req.params.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    return res.status(400).json({ error: "Invalid center id" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, center_id, center_name FROM collection_centers WHERE id = $1`,
      [centerId]
    );
    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ error: "Center not found" });
    }

    // Check if center has associated buckets
    const { rows: bucketRows } = await pool.query(
      `SELECT 1 FROM (
        SELECT collection_center_id FROM sap_buckets
        UNION ALL
        SELECT collection_center_id FROM treacle_buckets
      ) buckets WHERE collection_center_id = $1 LIMIT 1`,
      [centerId]
    );

    if (bucketRows.length > 0) {
      return res.status(400).json({ 
        error: "Cannot delete center with associated buckets. Deactivate instead." 
      });
    }

    await pool.query(`DELETE FROM collection_centers WHERE id = $1`, [centerId]);

    res.status(204).send();
  } catch (error) {
    console.error("ADMIN CENTER DELETE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
