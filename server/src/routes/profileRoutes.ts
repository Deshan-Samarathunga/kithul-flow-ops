import { Router } from "express";
import type { Request } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { auth } from "../middleware/authMiddleware.js";
import { patchProfile } from "../controllers/profileController.js";

const router = Router();

const uploadRoot = path.resolve(process.cwd(), "uploads");
const profileDir = path.join(uploadRoot, "profiles");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(profileDir);

function resolveUploadPath(relative: string) {
  const sanitized = relative.replace(/^\/+/, "");
  return path.resolve(process.cwd(), sanitized);
}

type ProfileRequest = Request & { file?: Express.Multer.File };

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    ensureDir(profileDir);
    cb(null, profileDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext.slice(0, 10).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image uploads are allowed"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

function sanitizeInput(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

router.patch("/", auth, upload.single("avatar"), patchProfile as any);

export default router;
