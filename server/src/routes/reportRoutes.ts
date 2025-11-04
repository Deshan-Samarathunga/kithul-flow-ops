import express from "express";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import { dailyReport } from "../controllers/reportController.js";

// Reporting routes for aggregated operational metrics.
const router = express.Router();

// Generate the daily production report for authorized roles.
router.get(
  "/daily",
  auth,
  requireRole("Field Collection", "Processing", "Packaging", "Labeling", "Administrator"),
  dailyReport as any,
);

export default router;
