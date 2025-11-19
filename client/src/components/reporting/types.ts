import type { DailyProductionReport } from "@/lib/apiClient";

export type ReportStage = "field" | "processing" | "packaging" | "labeling";
export type ProductKey = keyof DailyProductionReport["perProduct"];
export type ProductMetricsMap<T> = Partial<Record<ProductKey, T>>;

export type FieldMetrics = DailyProductionReport["perProduct"][ProductKey]["fieldCollection"];
export type ProcessingMetrics = DailyProductionReport["perProduct"][ProductKey]["processing"];
export type PackagingMetrics = DailyProductionReport["perProduct"][ProductKey]["packaging"];
export type LabelingMetrics = DailyProductionReport["perProduct"][ProductKey]["labeling"];

export type FieldTotals = DailyProductionReport["totals"]["fieldCollection"];
export type ProcessingTotals = DailyProductionReport["totals"]["processing"];
export type PackagingTotals = DailyProductionReport["totals"]["packaging"];
export type LabelingTotals = DailyProductionReport["totals"]["labeling"];

export type FieldStagePayload = {
  stage: "field";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<FieldMetrics>;
  totals: FieldTotals;
};

export type ProcessingStagePayload = {
  stage: "processing";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<ProcessingMetrics>;
  totals: ProcessingTotals;
};

export type PackagingStagePayload = {
  stage: "packaging";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<PackagingMetrics>;
  totals: PackagingTotals;
};

export type LabelingStagePayload = {
  stage: "labeling";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<LabelingMetrics>;
  totals: LabelingTotals;
};

export type StageReportPayload =
  | FieldStagePayload
  | ProcessingStagePayload
  | PackagingStagePayload
  | LabelingStagePayload;

export type DetailSheetConfig = {
  name: string;
  data: string[][];
  columnWidths: number[];
};

export type PackagingMaterialSource = {
  totalBottleQuantity: number;
  totalLidQuantity: number;
  totalAlufoilQuantity: number;
  totalVacuumBagQuantity: number;
  totalParchmentPaperQuantity: number;
};

export type LabelingAccessorySource = {
  totalStickerQuantity: number;
  totalShrinkSleeveQuantity: number;
  totalNeckTagQuantity: number;
  totalCorrugatedCartonQuantity: number;
};
