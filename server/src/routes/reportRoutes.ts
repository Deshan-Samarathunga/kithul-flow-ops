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
  totalGasCost: number;
  totalLaborCost: number;
};

type PackagingMetrics = {
  totalBatches: number;
  completedBatches: number;
  finishedQuantity: number;
  totalBottleCost: number;
  totalLidCost: number;
  totalAlufoilCost: number;
  totalVacuumBagCost: number;
  totalParchmentPaperCost: number;
};

type LabelingMetrics = {
  totalBatches: number;
  completedBatches: number;
  totalStickerCost: number;
  totalShrinkSleeveCost: number;
  totalNeckTagCost: number;
  totalCorrugatedCartonCost: number;
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
  totalGasCost: 0,
  totalLaborCost: 0,
});

const emptyPackaging = (): PackagingMetrics => ({
  totalBatches: 0,
  completedBatches: 0,
  finishedQuantity: 0,
  totalBottleCost: 0,
  totalLidCost: 0,
  totalAlufoilCost: 0,
  totalVacuumBagCost: 0,
  totalParchmentPaperCost: 0,
});

const emptyLabeling = (): LabelingMetrics => ({
  totalBatches: 0,
  completedBatches: 0,
  totalStickerCost: 0,
  totalShrinkSleeveCost: 0,
  totalNeckTagCost: 0,
  totalCorrugatedCartonCost: 0,
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
      COALESCE(SUM(pb.gas_cost), 0) AS total_gas_cost,
      COALESCE(SUM(pb.labor_cost), 0) AS total_labor_cost,
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
    totalGasCost: toNumber(row.total_gas_cost),
    totalLaborCost: toNumber(row.total_labor_cost),
  };
}

async function fetchPackagingMetrics(product: ProductSlug, targetDate: string): Promise<PackagingMetrics> {
  const packagingTable = getTableName("packagingBatches", product);
  const query = `
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed_batches,
      COALESCE(SUM(finished_quantity), 0) AS finished_quantity,
      COALESCE(SUM(bottle_cost), 0) AS total_bottle_cost,
      COALESCE(SUM(lid_cost), 0) AS total_lid_cost,
      COALESCE(SUM(alufoil_cost), 0) AS total_alufoil_cost,
      COALESCE(SUM(vacuum_bag_cost), 0) AS total_vacuum_bag_cost,
      COALESCE(SUM(parchment_paper_cost), 0) AS total_parchment_paper_cost
    FROM ${packagingTable}
    WHERE started_at::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  const row = rows[0] ?? {};
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    finishedQuantity: toNumber(row.finished_quantity),
    totalBottleCost: toNumber(row.total_bottle_cost),
    totalLidCost: toNumber(row.total_lid_cost),
    totalAlufoilCost: toNumber(row.total_alufoil_cost),
    totalVacuumBagCost: toNumber(row.total_vacuum_bag_cost),
    totalParchmentPaperCost: toNumber(row.total_parchment_paper_cost),
  };
}

async function fetchLabelingMetrics(product: ProductSlug, targetDate: string): Promise<LabelingMetrics> {
  const labelingTable = getTableName("labelingBatches", product);
  const query = `
    SELECT
      COUNT(*) AS total_batches,
      COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed_batches,
      COALESCE(SUM(sticker_cost), 0) AS total_sticker_cost,
      COALESCE(SUM(shrink_sleeve_cost), 0) AS total_shrink_sleeve_cost,
      COALESCE(SUM(neck_tag_cost), 0) AS total_neck_tag_cost,
      COALESCE(SUM(corrugated_carton_cost), 0) AS total_corrugated_carton_cost
    FROM ${labelingTable}
    WHERE created_at::date = $1
  `;
  const { rows } = await pool.query(query, [targetDate]);
  const row = rows[0] ?? {};
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    totalStickerCost: toNumber(row.total_sticker_cost),
    totalShrinkSleeveCost: toNumber(row.total_shrink_sleeve_cost),
    totalNeckTagCost: toNumber(row.total_neck_tag_cost),
    totalCorrugatedCartonCost: toNumber(row.total_corrugated_carton_cost),
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
        totals.processing.totalGasCost += report.processing.totalGasCost;
        totals.processing.totalLaborCost += report.processing.totalLaborCost;

        totals.packaging.totalBatches += report.packaging.totalBatches;
        totals.packaging.completedBatches += report.packaging.completedBatches;
        totals.packaging.finishedQuantity += report.packaging.finishedQuantity;
        totals.packaging.totalBottleCost += report.packaging.totalBottleCost;
        totals.packaging.totalLidCost += report.packaging.totalLidCost;
        totals.packaging.totalAlufoilCost += report.packaging.totalAlufoilCost;
        totals.packaging.totalVacuumBagCost += report.packaging.totalVacuumBagCost;
        totals.packaging.totalParchmentPaperCost += report.packaging.totalParchmentPaperCost;

        totals.labeling.totalBatches += report.labeling.totalBatches;
        totals.labeling.completedBatches += report.labeling.completedBatches;
        totals.labeling.totalStickerCost += report.labeling.totalStickerCost;
        totals.labeling.totalShrinkSleeveCost += report.labeling.totalShrinkSleeveCost;
        totals.labeling.totalNeckTagCost += report.labeling.totalNeckTagCost;
        totals.labeling.totalCorrugatedCartonCost += report.labeling.totalCorrugatedCartonCost;
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
