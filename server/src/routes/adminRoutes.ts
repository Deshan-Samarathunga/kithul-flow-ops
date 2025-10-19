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

export default router;
