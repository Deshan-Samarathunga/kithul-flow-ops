import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { SUPPORTED_PRODUCTS, getTableName, type ProductSlug } from "../routes/utils/productTables.js";
import {
  fetchFieldCollectionMetrics as svcFetchFieldCollectionMetrics,
  fetchProcessingMetrics as svcFetchProcessingMetrics,
  fetchPackagingMetrics as svcFetchPackagingMetrics,
  fetchLabelingMetrics as svcFetchLabelingMetrics,
} from "../services/reportsService.js";

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
  totalGasUsedKg: number;
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
  totalGasUsedKg: 0,
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
  const row = await svcFetchFieldCollectionMetrics(product, targetDate);
  return {
    drafts: toNumber(row.draft_count),
    buckets: toNumber(row.bucket_count),
    quantity: toNumber(row.total_quantity),
    draftIds: toStringArray(row.draft_ids),
  };
}

async function fetchProcessingMetrics(product: ProductSlug, targetDate: string): Promise<ProcessingMetrics> {
  const row = await svcFetchProcessingMetrics(product, targetDate);
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    totalOutput: toNumber(row.total_output),
    totalInput: toNumber(row.total_input),
    totalGasUsedKg: toNumber(row.total_gas_used_kg),
  };
}

async function fetchPackagingMetrics(product: ProductSlug, targetDate: string): Promise<PackagingMetrics> {
  const row = await svcFetchPackagingMetrics(product, targetDate);
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
  const row = await svcFetchLabelingMetrics(product, targetDate);
  return {
    totalBatches: toNumber(row.total_batches),
    completedBatches: toNumber(row.completed_batches),
    totalStickerQuantity: toNumber(row.total_sticker_quantity),
    totalShrinkSleeveQuantity: toNumber(row.total_shrink_sleeve_quantity),
    totalNeckTagQuantity: toNumber(row.total_neck_tag_quantity),
    totalCorrugatedCartonQuantity: toNumber(row.total_corrugated_carton_quantity),
  };
}

export async function dailyReport(req: Request, res: Response) {
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
      totals.processing.totalGasUsedKg += report.processing.totalGasUsedKg;

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
