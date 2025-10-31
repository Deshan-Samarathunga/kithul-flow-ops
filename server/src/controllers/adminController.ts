import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import {
  listUsers as svcListUsers,
  getUserById as svcGetUserById,
  insertUser as svcInsertUser,
  updateUserDynamic as svcUpdateUserDynamic,
  deleteUserById as svcDeleteUserById,
  listCenters as svcListCenters,
  getCenterById as svcGetCenterById,
  insertCenter as svcInsertCenter,
  updateCenterDynamic as svcUpdateCenterDynamic,
  centerHasCans as svcCenterHasCans,
  deleteCenterById as svcDeleteCenterById,
} from "../services/adminService.js";
import { normalizeRole, isAllowedRole, ROLE_LIST } from "../roles.js";
import { recordRoleAudit } from "../audit.js";
import type { JwtUser } from "../middleware/authMiddleware.js";

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

// Roles
export function getRoles(_req: Request, res: Response) {
  res.json({ roles: ROLE_LIST });
}

// Users
export async function listUsers(_req: Request, res: Response) {
  try {
    const rows = await svcListUsers();
    res.json({ users: rows.map(toClientUser) });
  } catch (error) {
    console.error("ADMIN LIST USERS ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getUser(req: Request, res: Response) {
  const userId = Number(req.params.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const user = await svcGetUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === "Administrator") {
      return res.status(403).json({ error: "Cannot load administrator via this endpoint" });
    }
    res.json(toClientUser(user));
  } catch (error) {
    console.error("ADMIN GET USER ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}

export async function createUser(req: Request, res: Response) {
  const parsed = createUserSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { userId, password, name, role } = parsed.data as {
    userId: string;
    password: string;
    name?: string;
    role: string;
  };

  const normalizedRole = normalizeRole(role);
  if (!normalizedRole || !isAllowedRole(normalizedRole) || normalizedRole === "Administrator") {
    return res.status(400).json({ error: "Unsupported role" });
  }

  const actor = (req as any).user as JwtUser;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await svcInsertUser(userId, passwordHash, name ?? null, normalizedRole);
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
}

export async function updateUser(req: Request, res: Response) {
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
    const existing = await svcGetUserById(userId);
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

    if ((parsed.data as any).name !== undefined) {
      const nameValue = (parsed.data as any).name?.length ? (parsed.data as any).name : null;
      updates.push(`name = $${updates.length + 1}`);
      params.push(nameValue);
    }

    if ((parsed.data as any).role !== undefined) {
      const normalizedRole = normalizeRole((parsed.data as any).role);
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

    if ((parsed.data as any).isActive !== undefined) {
      params.push((parsed.data as any).isActive);
    }

    if (updates.length === 0) {
      return res.json(toClientUser(existing));
    }

    params.push(userId);
    const updated = await svcUpdateUserDynamic(userId, updates.join(", "), params);

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
}

export async function deleteUser(req: Request, res: Response) {
  const targetId = Number(req.params.userId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const actor = (req as any).user as JwtUser;

  if (actor?.id === targetId) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    const existing = await svcGetUserById(targetId);
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === "Administrator") {
      return res.status(403).json({ error: "Cannot delete administrator accounts" });
    }
    await svcDeleteUserById(targetId);

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
}

// Centers
export async function listCenters(_req: Request, res: Response) {
  try {
    const rows = await svcListCenters();
    res.json({ centers: rows.map(toClientCenter) });
  } catch (error) {
    console.error("ADMIN LIST CENTERS ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}

export async function getCenter(req: Request, res: Response) {
  const centerId = Number(req.params.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    return res.status(400).json({ error: "Invalid center id" });
  }

  try {
    const center = await svcGetCenterById(centerId);
    if (!center) return res.status(404).json({ error: "Center not found" });
    res.json(toClientCenter(center));
  } catch (error) {
    console.error("ADMIN GET CENTER ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}

export async function createCenter(req: Request, res: Response) {
  const parsed = createCenterSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  const { centerId, centerName, location, centerAgent, contactPhone } = parsed.data as any;

  try {
    const created = await svcInsertCenter(centerId, centerName, location, centerAgent, contactPhone);
    res.status(201).json(toClientCenter(created));
  } catch (error: any) {
    if (error?.code === "23505" && error.constraint?.includes("center_id")) {
      return res.status(409).json({ error: "Center ID already exists" });
    }
    console.error("ADMIN CENTER CREATE ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function updateCenter(req: Request, res: Response) {
  const parsed = updateCenterSchema.safeParse((req as any).body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const centerId = Number(req.params.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    return res.status(400).json({ error: "Invalid center id" });
  }

  try {
    const existing = await svcGetCenterById(centerId);
    if (!existing) {
      return res.status(404).json({ error: "Center not found" });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if ((parsed.data as any).centerName !== undefined) {
      updates.push(`center_name = $${updates.length + 1}`);
      params.push((parsed.data as any).centerName);
    }

    if ((parsed.data as any).location !== undefined) {
      updates.push(`location = $${updates.length + 1}`);
      params.push((parsed.data as any).location);
    }

    if ((parsed.data as any).centerAgent !== undefined) {
      updates.push(`center_agent = $${updates.length + 1}`);
      params.push((parsed.data as any).centerAgent);
    }

    if ((parsed.data as any).contactPhone !== undefined) {
      updates.push(`contact_phone = $${updates.length + 1}`);
      params.push((parsed.data as any).contactPhone);
    }

    if ((parsed.data as any).isActive !== undefined) {
      updates.push(`is_active = $${updates.length + 1}`);
      params.push((parsed.data as any).isActive);
    }

    if (updates.length === 0) {
      return res.json(toClientCenter(existing));
    }

    params.push(centerId);
    const updated = await svcUpdateCenterDynamic(centerId, updates.join(", "), params);

    res.json(toClientCenter(updated));
  } catch (error) {
    console.error("ADMIN CENTER UPDATE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}

export async function deleteCenter(req: Request, res: Response) {
  const centerId = Number(req.params.centerId);
  if (!Number.isFinite(centerId) || centerId <= 0) {
    return res.status(400).json({ error: "Invalid center id" });
  }

  try {
    const existing = await svcGetCenterById(centerId);
    if (!existing) {
      return res.status(404).json({ error: "Center not found" });
    }

    const hasCans = await svcCenterHasCans(centerId);
    if (hasCans) {
      return res.status(400).json({
        error: "Cannot delete center with associated cans. Deactivate instead."
      });
    }

    await svcDeleteCenterById(centerId);

    res.status(204).send();
  } catch (error) {
    console.error("ADMIN CENTER DELETE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}
