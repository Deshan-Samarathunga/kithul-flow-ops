import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt, { Secret } from "jsonwebtoken";
import { pool } from "../db.js";
import { DEFAULT_ROLE, isSelfServiceRole, normalizeRole } from "../roles.js";
import { recordRoleAudit } from "../audit.js";

function getJwtSecret(): Secret {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Missing JWT_SECRET");
  return s as Secret;
}

const registerSchema = z
  .object({
    userId: z
      .string()
      .min(3)
      .max(40)
      .regex(
        /^[a-zA-Z0-9_\-\.]+$/,
        "userId may only contain letters, numbers, dots, hyphens, and underscores",
      )
      .transform((s) => s.trim()),
    password: z.string().min(8),
    name: z.string().max(120).optional(),
    role: z.string().optional(),
  })
  .transform(({ name, userId, ...rest }) => ({
    ...rest,
    userId,
    name: name && name.trim().length > 0 ? name.trim() : undefined,
  }));

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse((req as any).body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const { userId, password, name, role } = parsed.data as {
      userId: string;
      password: string;
      name?: string;
      role?: string;
    };

    const requestedRole = normalizeRole(role);
    const chosenRole =
      requestedRole && isSelfServiceRole(requestedRole) ? requestedRole : DEFAULT_ROLE;
    if (requestedRole && !isSelfServiceRole(requestedRole)) {
      console.warn(
        `[auth] blocked self-registration role selection "${requestedRole}" for ${userId}`,
      );
      recordRoleAudit({
        event: "blocked_self_register_role",
        actorUserId: userId,
        newRole: requestedRole,
        metadata: { attemptVia: "register" },
      }).catch((err) => console.error("audit log failed (register blockade)", err));
    }

    const hash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO public.users (user_id, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, role, created_at, profile_image`,
      [userId, hash, name ?? null, chosenRole],
    );

    const created = rows[0];
    res.status(201).json({
      id: created.id,
      userId: created.user_id,
      name: created.name,
      role: created.role,
      createdAt: created.created_at,
      profileImage: created.profile_image ?? null,
      isActive: true,
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      const constraint = e?.constraint ?? "";
      if (constraint.includes("user_id")) {
        return res.status(409).json({ error: "User ID already in use" });
      }
      return res.status(409).json({ error: "Account already exists" });
    }
    console.error("REGISTER ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
}

const loginSchema = z.object({
  userId: z
    .string()
    .min(3)
    .max(40)
    .transform((s) => s.trim()),
  password: z.string().min(8),
});

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginSchema.safeParse((req as any).body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
    const { userId, password } = parsed.data as { userId: string; password: string };

    const { rows } = await pool.query(
      `SELECT id, user_id, name, role, password_hash, profile_image
         FROM public.users WHERE user_id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, userId: user.user_id, role: user.role }, getJwtSecret(), {
      expiresIn: (process.env.JWT_EXPIRES as any) || ("7d" as any),
    });

    res.json({
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        name: user.name,
        role: user.role,
        profileImage: user.profile_image ?? null,
        isActive: true,
      },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    res.status(500).json({ error: "Server error" });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const payload = jwt.verify(token, getJwtSecret()) as { id: number };
    const { rows } = await pool.query(
      "SELECT id, user_id, name, role, created_at, profile_image FROM public.users WHERE id = $1",
      [payload.id],
    );
    const user = rows[0];
    if (!user) return res.json(null);
    res.json({
      id: user.id,
      userId: user.user_id,
      name: user.name,
      role: user.role,
      createdAt: user.created_at,
      profileImage: user.profile_image ?? null,
      isActive: true,
    });
  } catch (e) {
    console.error("ME ERROR:", e);
    res.status(401).json({ error: "Invalid token" });
  }
}
