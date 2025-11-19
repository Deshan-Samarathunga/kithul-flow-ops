import type {
  DetailSheetConfig,
  FieldMetrics,
  LabelingMetrics,
  PackagingMaterialSource,
  PackagingMetrics,
  ProcessingMetrics,
  ProductKey,
  StageReportPayload,
  LabelingAccessorySource,
} from "./types";

export type FormatNumberFn = (
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
) => string;

export type BuildDetailSheetHelpers = {
  productLabels: Record<ProductKey, string>;
  formatNumber: FormatNumberFn;
  noValueDisplay: string;
  getPackagingMaterialsTotal: (metrics: PackagingMaterialSource) => number;
  getLabelingAccessoriesTotal: (metrics: LabelingAccessorySource) => number;
};

export function buildDetailSheet(
  payload: StageReportPayload,
  stageName: string,
  helpers: BuildDetailSheetHelpers,
): DetailSheetConfig | null {
  const {
    productLabels,
    formatNumber,
    noValueDisplay,
    getPackagingMaterialsTotal,
    getLabelingAccessoriesTotal,
  } = helpers;

  const detailName = `${stageName} Detail`;

  switch (payload.stage) {
    case "field": {
      const entries = (
        Object.entries(payload.perProduct) as Array<[ProductKey, FieldMetrics | undefined]>
      ).filter((entry): entry is [ProductKey, FieldMetrics] => entry[1] !== undefined);

      const header = ["Product", "Draft IDs", "Drafts", "Cans", "Quantity (L)"];
      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        metrics.draftIds && metrics.draftIds.length > 0
          ? metrics.draftIds.join(", ")
          : noValueDisplay,
        formatNumber(metrics.drafts),
        formatNumber(metrics.cans),
        formatNumber(metrics.quantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ]);

      rows.push([
        "Totals",
        payload.totals.draftIds && payload.totals.draftIds.length > 0
          ? payload.totals.draftIds.join(", ")
          : noValueDisplay,
        formatNumber(payload.totals.drafts),
        formatNumber(payload.totals.cans),
        formatNumber(payload.totals.quantity, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [16, 38, 12, 12, 18],
      };
    }
    case "processing": {
      const entries = (
        Object.entries(payload.perProduct) as Array<[ProductKey, ProcessingMetrics | undefined]>
      ).filter((entry): entry is [ProductKey, ProcessingMetrics] => entry[1] !== undefined);

      const header = [
        "Product",
        "Batches",
        "Completed",
        "Input (Treacle L / Jaggery kg)",
        "Output (Treacle L / Jaggery kg)",
        "Used gas (kg)",
      ];

      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        formatNumber(metrics.totalBatches),
        formatNumber(metrics.completedBatches),
        formatNumber(metrics.totalInput, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        formatNumber(metrics.totalOutput, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        formatNumber(metrics.totalGasUsedKg, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [18, 12, 12, 32, 32, 18],
      };
    }
    case "packaging": {
      const entries = (
        Object.entries(payload.perProduct) as Array<[ProductKey, PackagingMetrics | undefined]>
      ).filter((entry): entry is [ProductKey, PackagingMetrics] => entry[1] !== undefined);

      const header = [
        "Product",
        "Batches",
        "Completed",
        "Finished qty (Treacle L / Jaggery kg)",
        "Bottle quantity",
        "Lid quantity",
        "Alufoil quantity",
        "Vacuum bag quantity",
        "Parchment paper quantity",
        "Materials total",
      ];

      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        formatNumber(metrics.totalBatches),
        formatNumber(metrics.completedBatches),
        formatNumber(metrics.finishedQuantity, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
        formatNumber(metrics.totalBottleQuantity),
        formatNumber(metrics.totalLidQuantity),
        formatNumber(metrics.totalAlufoilQuantity),
        formatNumber(metrics.totalVacuumBagQuantity),
        formatNumber(metrics.totalParchmentPaperQuantity),
        formatNumber(getPackagingMaterialsTotal(metrics)),
      ]);

      rows.push([
        "Totals",
        formatNumber(payload.totals.totalBatches),
        formatNumber(payload.totals.completedBatches),
        formatNumber(payload.totals.finishedQuantity, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
        formatNumber(payload.totals.totalBottleQuantity),
        formatNumber(payload.totals.totalLidQuantity),
        formatNumber(payload.totals.totalAlufoilQuantity),
        formatNumber(payload.totals.totalVacuumBagQuantity),
        formatNumber(payload.totals.totalParchmentPaperQuantity),
        formatNumber(getPackagingMaterialsTotal(payload.totals)),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [18, 12, 12, 34, 18, 18, 18, 20, 24, 22],
      };
    }
    case "labeling": {
      const entries = (
        Object.entries(payload.perProduct) as Array<[ProductKey, LabelingMetrics | undefined]>
      ).filter((entry): entry is [ProductKey, LabelingMetrics] => entry[1] !== undefined);

      const header = [
        "Product",
        "Batches",
        "Completed",
        "Sticker quantity",
        "Shrink sleeve quantity",
        "Neck tag quantity",
        "Corrugated carton quantity",
        "Accessory total",
      ];

      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        formatNumber(metrics.totalBatches),
        formatNumber(metrics.completedBatches),
        formatNumber(metrics.totalStickerQuantity),
        formatNumber(metrics.totalShrinkSleeveQuantity),
        formatNumber(metrics.totalNeckTagQuantity),
        formatNumber(metrics.totalCorrugatedCartonQuantity),
        formatNumber(getLabelingAccessoriesTotal(metrics)),
      ]);

      rows.push([
        "Totals",
        formatNumber(payload.totals.totalBatches),
        formatNumber(payload.totals.completedBatches),
        formatNumber(payload.totals.totalStickerQuantity),
        formatNumber(payload.totals.totalShrinkSleeveQuantity),
        formatNumber(payload.totals.totalNeckTagQuantity),
        formatNumber(payload.totals.totalCorrugatedCartonQuantity),
        formatNumber(getLabelingAccessoriesTotal(payload.totals)),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [18, 12, 12, 18, 22, 18, 26, 22],
      };
    }
    default:
      return null;
  }
}
