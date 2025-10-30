import express from "express";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import { dailyReport } from "../controllers/reportController.js";

const router = express.Router();

router.get(
  "/daily",
  auth,
  requireRole("Field Collection", "Processing", "Packaging", "Labeling", "Administrator"),
  dailyReport as any
);

export default router;
