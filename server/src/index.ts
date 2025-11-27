import "dotenv/config";
import type { Server } from "http";
import { pathToFileURL } from "url";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import fieldCollectionRoutes from "./routes/fieldCollectionRoutes.js";
import processingRoutes from "./routes/processingRoutes.js";
import packagingRoutes from "./routes/packagingRoutes.js";
import labelingRoutes from "./routes/labelingRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { auth, requireRole } from "./middleware/authMiddleware.js";
import { pool, initializeDatabase } from "./db.js";
import { ensureAppDataDir, resolveAppData } from "./config/paths.js";

const app = express();
const uploadsDir = resolveAppData("uploads");
ensureAppDataDir(uploadsDir);

let configuredOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:8080";

// ---- CORS (dev friendly)
app.use(
  cors({
    origin(origin, cb) {
      const allow = new Set([
        configuredOrigin,
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

      if (!origin) return cb(null, true);
      if (allow.has(origin)) return cb(null, true);

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
  }),
);

// ---- security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
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
app.use("/uploads", express.static(uploadsDir));

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
app.use("/api/packaging", packagingRoutes);
app.use("/api/labeling", labelingRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/admin/stats", auth, requireRole("Administrator"), (_req, res) => {
  res.json({ secret: "admin-only numbers" });
});

// ---- 404 + error handler
app.use((_req, res) => res.status(404).json({ error: "Not Found" }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ error: "Server error" });
});

type StartOptions = {
  port?: number;
  clientOrigin?: string;
};

let httpServer: Server | null = null;

export async function startServer(options: StartOptions = {}) {
  if (httpServer) {
    return httpServer;
  }

  const port = options.port ?? Number(process.env.PORT ?? 5000);
  configuredOrigin = options.clientOrigin ?? configuredOrigin;

  try {
    await initializeDatabase();
    await new Promise<void>((resolve) => {
      httpServer = app.listen(port, () => {
        console.log(`[server] http://localhost:${port}`);
        console.log(`[cors] allowing origin: ${configuredOrigin}`);
        resolve();
      });
    });
    return httpServer;
  } catch (error) {
    console.error("Failed to start server", error);
    throw error;
  }
}

export async function stopServer() {
  if (!httpServer) return;
  await new Promise<void>((resolve, reject) => {
    httpServer?.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  httpServer = null;
}

const isCliEntry = (() => {
  try {
    const cliUrl = pathToFileURL(process.argv[1] ?? "");
    return cliUrl.href === import.meta.url;
  } catch (error) {
    return false;
  }
})();

if (isCliEntry) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
