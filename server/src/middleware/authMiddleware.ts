import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type JwtUser = {
  id: number;
  userId: string;
  role?: string;
};

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtUser;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  const allow = new Set(roles.map((r) => String(r).toLowerCase()));
  return (req: Request, res: Response, next: NextFunction) => {
    const role = String((req as any).user?.role || "").toLowerCase();
    if (!allow.has(role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}


