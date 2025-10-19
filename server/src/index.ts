import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import fieldCollectionRoutes from "./routes/fieldCollectionRoutes.js";
import processingRoutes from "./routes/processingRoutes.js";
import { auth, requireRole } from "./middleware/authMiddleware.js";
import { pool } from "./db.js";

const app = express();

// ---- config
const PORT = Number(process.env.PORT ?? 5000);
const ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:8080";

// ---- CORS (dev friendly)
app.use(
  cors({
    origin(origin, cb) {
      // allow no-origin (curl/Postman) and common local dev origins
      const allow = new Set([
        ORIGIN,
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://[::1]:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://[::1]:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
        "http://[::1]:8082",
        "http://localhost:8083",
        "http://127.0.0.1:8083",
        "http://[::1]:8083",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://[::1]:5173",
      ]);
      
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return cb(null, true);
      
      // Check if origin is in allowed list
      if (allow.has(origin)) return cb(null, true);
      
      // In development, allow any localhost/local network origin
      const isLocalDev = 
        origin.startsWith("http://localhost:") || 
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("http://[::1]:") ||
        origin.match(/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/);
      
      if (isLocalDev) {
        console.log(`[cors] allowing origin: ${origin}`);
        return cb(null, true);
      }
      
      console.warn(`CORS blocked origin: ${origin}`);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ---- security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ---- rate limiting (auth endpoints)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/", authLimiter);

app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// ---- diagnostics
app.all("/api/db-ping", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 as ok");
    res.json(rows[0]); // { ok: 1 }
  } catch (e) {
    console.error("DB ping error:", e);
    res.status(500).json({ error: "db ping failed" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kithul-flow-ops", time: new Date().toISOString() });
});

// ---- routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/field-collection", fieldCollectionRoutes);
app.use("/api/processing", processingRoutes);

app.get("/api/admin/stats", auth, requireRole("Administrator"), (_req, res) => {
  res.json({ secret: "admin-only numbers" });
});

// ---- 404 + error handler
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ error: "Server error" });
});

// ---- start
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[cors] allowing origin: ${ORIGIN}`);
});
