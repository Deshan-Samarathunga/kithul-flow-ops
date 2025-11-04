import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import type { JwtUser } from "../middleware/authMiddleware.js";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const profileDir = path.join(uploadRoot, "profiles");

function resolveUploadPath(relative: string) {
  const sanitized = relative.replace(/^\/+/, "");
  return path.resolve(process.cwd(), sanitized);
}

type ProfileRequest = Request & { file?: Express.Multer.File };

export async function patchProfile(req: Request, res: Response) {
  const uploadedFile = (req as ProfileRequest).file;
  const temporaryUploadPath = uploadedFile ? path.join(profileDir, uploadedFile.filename) : null;
  let finalUploadPath: string | null = null;

  try {
    const actor = (req as any).user as JwtUser;
    const userId = actor?.id;
    if (!userId) {
      if (temporaryUploadPath) {
        fs.promises.unlink(temporaryUploadPath).catch(() => {});
      }
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { rows } = await pool.query(
      `SELECT id, user_id, name, role, password_hash, profile_image
         FROM public.users
        WHERE id = $1`,
      [userId],
    );
    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const body = (req.body || {}) as Record<string, string>;
    const sanitize = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : undefined);
    const name = sanitize(body?.name);
    const currentPassword = sanitize(body?.currentPassword);
    const newPassword = sanitize(body?.newPassword);

    const updateFragments: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updateFragments.push(`name = $${updateFragments.length + 1}`);
      params.push(name);
      existing.name = name;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }
      if (!currentPassword) {
        return res
          .status(400)
          .json({ error: "Current password is required to set a new password" });
      }
      const ok = await bcrypt.compare(currentPassword, existing.password_hash);
      if (!ok) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      updateFragments.push(`password_hash = $${updateFragments.length + 1}`);
      params.push(hash);
    }

    let newProfilePath: string | undefined;
    if (uploadedFile && temporaryUploadPath) {
      const ext = path.extname(uploadedFile.originalname || "") || ".png";
      const safeExt = ext.slice(0, 10).toLowerCase();
      const normalizedExt = safeExt.startsWith(".") ? safeExt : `.${safeExt}`;
      const newFilename = `user_${existing.user_id}-${Date.now()}${normalizedExt}`;
      finalUploadPath = path.join(profileDir, newFilename);
      await fs.promises.rename(temporaryUploadPath, finalUploadPath);
      newProfilePath = `/uploads/profiles/${newFilename}`;
      updateFragments.push(`profile_image = $${updateFragments.length + 1}`);
      params.push(newProfilePath);
    }

    if (updateFragments.length > 0) {
      params.push(userId);
      await pool.query(
        `UPDATE public.users
            SET ${updateFragments.join(", ")}
          WHERE id = $${params.length}`,
        params,
      );

      if (newProfilePath) {
        const previous = existing.profile_image as string | null;
        existing.profile_image = newProfilePath;
        if (previous && previous !== newProfilePath) {
          const previousPath = resolveUploadPath(previous);
          if (previousPath.startsWith(uploadRoot)) {
            fs.promises.unlink(previousPath).catch(() => {});
          }
        }
      }
    }

    res.json({
      id: existing.id,
      userId: existing.user_id,
      name: existing.name,
      role: existing.role,
      profileImage: newProfilePath ?? existing.profile_image ?? null,
    });
  } catch (error: any) {
    const cleanupPath = finalUploadPath ?? temporaryUploadPath;
    if (cleanupPath) {
      fs.promises.unlink(cleanupPath).catch(() => {});
    }
    if (error?.message === "Only image uploads are allowed") {
      return res.status(400).json({ error: error.message });
    }
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Image must be smaller than 5MB" });
    }
    console.error("PROFILE UPDATE ERROR:", error);
    res.status(500).json({ error: "Server error" });
  }
}
