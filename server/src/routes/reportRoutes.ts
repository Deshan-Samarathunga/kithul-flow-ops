import express from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";
import {
  SUPPORTED_PRODUCTS,
  getTableName,
  type ProductSlug,
} from "./utils/productTables.js";

const router = express.Router();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

type FieldCollectionMetrics = {
  drafts: number;
  buckets: number;
  quantity: number;
  draftIds: string[];
};

type ProcessingMetrics = {
  totalBatches: number;
  completedBatches: number;
  totalOutput: number;
  totalInput: number;
  totalUsedGasKg: number;
};

type PackagingMetrics = {
  totalBatches: number;
  completedBatches: number;
  finishedQuantity: number;
  totalBottleQuantity: number;
  totalLidQuantity: number;
  totalAlufoilQuantity: number;
  totalVacuumBagQuantity: number;
  totalParchmentPaperQuantity: number;
};

type LabelingMetrics = {
  totalBatches: number;
  completedBatches: number;
  totalStickerQuantity: number;
  totalShrinkSleeveQuantity: number;
  totalNeckTagQuantity: number;
  totalCorrugatedCartonQuantity: number;
};

type ProductReport = {
  product: ProductSlug;
  fieldCollection: FieldCollectionMetrics;
  processing: ProcessingMetrics;
  packaging: PackagingMetrics;
  labeling: LabelingMetrics;
};

type ReportTotals = {
  fieldCollection: FieldCollectionMetrics;
  processing: ProcessingMetrics;
  packaging: PackagingMetrics;
  labeling: LabelingMetrics;
};

const emptyFieldCollection = (): FieldCollectionMetrics => ({ drafts: 0, buckets: 0, quantity: 0, draftIds: [] });

const emptyProcessing = (): ProcessingMetrics => ({
  totalBatches: 0,
  completedBatches: 0,
  totalOutput: 0,
  totalInput: 0,
  totalUsedGasKg: 0,
});

const emptyPackaging = (): PackagingMetrics => ({
  totalBatches: 0,
  completedBatches: 0,
  finishedQuantity: 0,
  totalBottleQuantity: 0,
  totalLidQuantity: 0,
  totalAlufoilQuantity: 0,
  totalVacuumBagQuantity: 0,
  totalParchmentPaperQuantity: 0,
});

const emptyLabeling = (): LabelingMetrics => ({
  totalBatches: 0,
  completedBatches: 0,
  totalStickerQuantity: 0,
  totalShrinkSleeveQuantity: 0,
  totalNeckTagQuantity: 0,
  totalCorrugatedCartonQuantity: 0,
});

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
      if (typeof item === "number") {
        return String(item);
      }
      if (item && typeof item === "object" && "value" in (item as Record<string, unknown>)) {
        const inner = (item as Record<string, unknown>).value;
        return typeof inner === "string" ? inner : inner != null ? String(inner) : null;
      }
      return item != null ? String(item) : null;
    })
    .filter((item): item is string => item !== null);
};

async function fetchFieldCollectionMetrics(product: ProductSlug, targetDate: string): Promise<FieldCollectionMetrics> {
  const bucketsTable = getTableName("buckets", product);
  const query = `
    SELECT
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.id::text), NULL) AS draft_ids,
      COUNT(DISTINCT d.id) AS draft_count,
      COUNT(b.id) AS bucket_count,
      COALESCE(SUM(b.quantity), 0) AS total_quantity
    FROM field_collection_drafts d
    LEFT JOIN ${bucketsTable} b ON b.draft_id = d.id
    WHERE d.date::date = $1
      AND LOWER(d.status) IN ('submitted', 'completed')
  `;
  const { rows } = await pool.query(query, [targetDate]);
  const row = rows[0] ?? {};
  return {
    drafts: toNumber(row.draft_count),
    buckets: toNumber(row.bucket_count),
    quantity: toNumber(row.total_quantity),
    draftIds: toStringArray(row.draft_ids),
  };
}

async function fetchProcessingMetrics(product: ProductSlug, targetDate: string): Promise<ProcessingMetrics> {
  const processingTable = getTableName("processingBatches", product);
  const batchBucketTable = getTableName("processingBatchBuckets", product);
  const bucketTable = getTableName("buckets", product);
  const query = `
    WITH bucket_totals AS (
      SELECT pbb.processing_batch_id, COALESCE(SUM(b.quantity), 0) AS total_input
      FROM ${batchBucketTable} pbb
      JOIN ${bucketTable} b ON b.id = pbb.bucket_id
      GROUP BY pbb.processing_batch_id
    )
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(pb.status) = 'completed') AS completed_batches,
      COALESCE(SUM(pb.total_sap_output), 0) AS total_output,
  COALESCE(SUM(pb.used_gas_kg), 0) AS total_used_gas_kg,
      COALESCE(SUM(bucket_totals.total_input), 0) AS total_input
    FROM ${processingTable} pb
    LEFT JOIN bucket_totals ON bucket_totals.processing_batch_id = pb.id
    WHERE pb.scheduled_date::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  const row = rows[0] ?? {};
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    totalOutput: toNumber(row.total_output),
    totalInput: toNumber(row.total_input),
  totalUsedGasKg: toNumber(row.total_used_gas_kg),
  };
}

async function fetchPackagingMetrics(product: ProductSlug, targetDate: string): Promise<PackagingMetrics> {
  const packagingTable = getTableName("packagingBatches", product);
  const query = `
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed_batches,
      COALESCE(SUM(finished_quantity), 0) AS finished_quantity,
      COALESCE(SUM(bottle_quantity), 0) AS total_bottle_quantity,
      COALESCE(SUM(lid_quantity), 0) AS total_lid_quantity,
      COALESCE(SUM(alufoil_quantity), 0) AS total_alufoil_quantity,
      COALESCE(SUM(vacuum_bag_quantity), 0) AS total_vacuum_bag_quantity,
      COALESCE(SUM(parchment_paper_quantity), 0) AS total_parchment_paper_quantity
    FROM ${packagingTable}
    WHERE started_at::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  const row = rows[0] ?? {};
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    finishedQuantity: toNumber(row.finished_quantity),
    totalBottleQuantity: toNumber(row.total_bottle_quantity),
    totalLidQuantity: toNumber(row.total_lid_quantity),
    totalAlufoilQuantity: toNumber(row.total_alufoil_quantity),
    totalVacuumBagQuantity: toNumber(row.total_vacuum_bag_quantity),
    totalParchmentPaperQuantity: toNumber(row.total_parchment_paper_quantity),
  };
}

async function fetchLabelingMetrics(product: ProductSlug, targetDate: string): Promise<LabelingMetrics> {
  const labelingTable = getTableName("labelingBatches", product);
  const query = `
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed_batches,
      COALESCE(SUM(sticker_quantity), 0) AS total_sticker_quantity,
      COALESCE(SUM(shrink_sleeve_quantity), 0) AS total_shrink_sleeve_quantity,
      COALESCE(SUM(neck_tag_quantity), 0) AS total_neck_tag_quantity,
      COALESCE(SUM(corrugated_carton_quantity), 0) AS total_corrugated_carton_quantity
    FROM ${labelingTable}
    WHERE created_at::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  const row = rows[0] ?? {};
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    totalStickerQuantity: toNumber(row.total_sticker_quantity),
    totalShrinkSleeveQuantity: toNumber(row.total_shrink_sleeve_quantity),
    totalNeckTagQuantity: toNumber(row.total_neck_tag_quantity),
    totalCorrugatedCartonQuantity: toNumber(row.total_corrugated_carton_quantity),
  };
}

router.get(
  "/daily",
  auth,
  requireRole("Field Collection", "Processing", "Packaging", "Labeling", "Administrator"),
  async (req, res) => {
    try {
      const rawDate = typeof req.query.date === "string" && req.query.date.trim() ? req.query.date.trim() : null;
      const targetDate = rawDate ? dateSchema.parse(rawDate) : new Date().toISOString().slice(0, 10);

      const perProduct: Record<ProductSlug, ProductReport> = {
        sap: {
          product: "sap",
          fieldCollection: emptyFieldCollection(),
          processing: emptyProcessing(),
          packaging: emptyPackaging(),
          labeling: emptyLabeling(),
        },
        treacle: {
          product: "treacle",
          fieldCollection: emptyFieldCollection(),
          processing: emptyProcessing(),
          packaging: emptyPackaging(),
          labeling: emptyLabeling(),
        },
      };

      for (const product of SUPPORTED_PRODUCTS) {
        const fieldCollection = await fetchFieldCollectionMetrics(product, targetDate);
        const processing = await fetchProcessingMetrics(product, targetDate);
        const packaging = await fetchPackagingMetrics(product, targetDate);
        const labeling = await fetchLabelingMetrics(product, targetDate);

        perProduct[product] = {
          product,
          fieldCollection,
          processing,
          packaging,
          labeling,
        };
      }

      const totals: ReportTotals = {
        fieldCollection: emptyFieldCollection(),
        processing: emptyProcessing(),
        packaging: emptyPackaging(),
        labeling: emptyLabeling(),
      };

      for (const product of SUPPORTED_PRODUCTS) {
        const report = perProduct[product];
        totals.fieldCollection.drafts += report.fieldCollection.drafts;
        totals.fieldCollection.buckets += report.fieldCollection.buckets;
        totals.fieldCollection.quantity += report.fieldCollection.quantity;
        totals.fieldCollection.draftIds = Array.from(
          new Set([...totals.fieldCollection.draftIds, ...report.fieldCollection.draftIds])
        );

        totals.processing.totalBatches += report.processing.totalBatches;
        totals.processing.completedBatches += report.processing.completedBatches;
        totals.processing.totalOutput += report.processing.totalOutput;
        totals.processing.totalInput += report.processing.totalInput;
         totals.processing.totalUsedGasKg += report.processing.totalUsedGasKg;

        totals.packaging.totalBatches += report.packaging.totalBatches;
        totals.packaging.completedBatches += report.packaging.completedBatches;
        totals.packaging.finishedQuantity += report.packaging.finishedQuantity;
         totals.packaging.totalBottleQuantity += report.packaging.totalBottleQuantity;
         totals.packaging.totalLidQuantity += report.packaging.totalLidQuantity;
         totals.packaging.totalAlufoilQuantity += report.packaging.totalAlufoilQuantity;
         totals.packaging.totalVacuumBagQuantity += report.packaging.totalVacuumBagQuantity;
         totals.packaging.totalParchmentPaperQuantity += report.packaging.totalParchmentPaperQuantity;

        totals.labeling.totalBatches += report.labeling.totalBatches;
        totals.labeling.completedBatches += report.labeling.completedBatches;
         totals.labeling.totalStickerQuantity += report.labeling.totalStickerQuantity;
         totals.labeling.totalShrinkSleeveQuantity += report.labeling.totalShrinkSleeveQuantity;
         totals.labeling.totalNeckTagQuantity += report.labeling.totalNeckTagQuantity;
         totals.labeling.totalCorrugatedCartonQuantity += report.labeling.totalCorrugatedCartonQuantity;
      }

      res.json({
        date: targetDate,
        generatedAt: new Date().toISOString(),
        perProduct,
        totals,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid date", details: error.issues });
      }
      console.error("Error generating daily production report:", error);
      res.status(500).json({ error: "Failed to generate daily production report" });
    }
  }
);

export default router;
