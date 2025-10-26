import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCcw, Download, CalendarDays } from "lucide-react";
import { utils, writeFileXLSX, type CellObject, type WorkSheet } from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import DataService from "@/lib/dataService";
import type { DailyProductionReport } from "@/lib/apiClient";

type ReportStage = "field" | "processing" | "packaging" | "labeling";
type ProductKey = "sap" | "treacle";

type ProductMetricsMap<T> = Partial<Record<ProductKey, T>>;

const productLabels: Record<ProductKey, string> = {
  sap: "Sap",
  treacle: "Treacle",
};

const productUnits: Record<ProductKey, string> = {
  sap: "L",
  treacle: "kg",
};

const stageMeta: Record<ReportStage, { title: string; description: string }> = {
  field: {
    title: "Field collection daily report",
    description: "Review the drafts and collection buckets recorded for the selected day.",
  },
  processing: {
    title: "Processing daily report",
    description: "Summarise processing throughput, output, and gas usage for the chosen date.",
  },
  packaging: {
    title: "Packaging daily report",
    description: "Track packaging batches, finished quantities, and material costs for the date.",
  },
  labeling: {
    title: "Labeling daily report",
    description: "Inspect labeling progress and accessory costs captured for the selected day.",
  },
};

const todayString = () => new Date().toISOString().slice(0, 10);

const formatNumber = (
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
) => {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? (value % 1 === 0 ? 0 : 2),
  });
};

const formatCurrency = (value: number) =>
  `Rs ${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type FieldMetrics = DailyProductionReport["perProduct"]["sap"]["fieldCollection"];
type ProcessingMetrics = DailyProductionReport["perProduct"]["sap"]["processing"];
type PackagingMetrics = DailyProductionReport["perProduct"]["sap"]["packaging"];
type LabelingMetrics = DailyProductionReport["perProduct"]["sap"]["labeling"];

type FieldTotals = DailyProductionReport["totals"]["fieldCollection"];
type ProcessingTotals = DailyProductionReport["totals"]["processing"];
type PackagingTotals = DailyProductionReport["totals"]["packaging"];
type LabelingTotals = DailyProductionReport["totals"]["labeling"];

type FieldStagePayload = {
  stage: "field";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<FieldMetrics>;
  totals: FieldTotals;
};

type ProcessingStagePayload = {
  stage: "processing";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<ProcessingMetrics>;
  totals: ProcessingTotals;
};

type PackagingStagePayload = {
  stage: "packaging";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<PackagingMetrics & { totalCost: number }>;
  totals: PackagingTotals & { totalCost: number };
};

type LabelingStagePayload = {
  stage: "labeling";
  date: string;
  generatedAt: string;
  perProduct: ProductMetricsMap<LabelingMetrics & { totalCost: number }>;
  totals: LabelingTotals & { totalCost: number };
};

type StageReportPayload =
  | FieldStagePayload
  | ProcessingStagePayload
  | PackagingStagePayload
  | LabelingStagePayload;

type DetailSheetConfig = {
  name: string;
  data: string[][];
  columnWidths: number[];
};

function buildDetailSheet(payload: StageReportPayload, stageName: string): DetailSheetConfig | null {
  const detailName = `${stageName} Detail`;

  switch (payload.stage) {
    case "field": {
      const entries = (Object.entries(payload.perProduct) as Array<[
        ProductKey,
        FieldMetrics | undefined
      ]>).filter((entry): entry is [ProductKey, FieldMetrics] => entry[1] !== undefined);

      const header = ["Product", "Draft IDs", "Drafts", "Buckets", "Quantity (L)"];
      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        metrics.draftIds && metrics.draftIds.length > 0 ? metrics.draftIds.join(", ") : "—",
        formatNumber(metrics.drafts),
        formatNumber(metrics.buckets),
        formatNumber(metrics.quantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ]);

      rows.push([
        "Totals",
        payload.totals.draftIds && payload.totals.draftIds.length > 0
          ? payload.totals.draftIds.join(", ")
          : "—",
        formatNumber(payload.totals.drafts),
        formatNumber(payload.totals.buckets),
        formatNumber(payload.totals.quantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [16, 38, 12, 12, 18],
      };
    }
    case "processing": {
      const entries = (Object.entries(payload.perProduct) as Array<[
        ProductKey,
        ProcessingMetrics | undefined
      ]>).filter((entry): entry is [ProductKey, ProcessingMetrics] => entry[1] !== undefined);

      const header = [
        "Product",
        "Batches",
        "Completed",
        "Input (Sap L / Treacle kg)",
        "Output (Sap L / Treacle kg)",
        "Used gas (kg)",
      ];

      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        formatNumber(metrics.totalBatches),
        formatNumber(metrics.completedBatches),
        formatNumber(metrics.totalInput, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        formatNumber(metrics.totalOutput, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        formatNumber(metrics.totalGasUsedKg, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [18, 12, 12, 26, 26, 18],
      };
    }
    case "packaging": {
      const entries = (Object.entries(payload.perProduct) as Array<[
        ProductKey,
        (PackagingMetrics & { totalCost: number }) | undefined
      ]>).filter((entry): entry is [ProductKey, PackagingMetrics & { totalCost: number }] => entry[1] !== undefined);

      const header = [
        "Product",
        "Batches",
        "Completed",
        "Finished qty (Sap L / Treacle kg)",
        "Bottle cost",
        "Lid cost",
        "Alufoil cost",
        "Vacuum bag cost",
        "Parchment paper cost",
        "Total packaging cost",
      ];

      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        formatNumber(metrics.totalBatches),
        formatNumber(metrics.completedBatches),
        formatNumber(metrics.finishedQuantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        formatCurrency(metrics.totalBottleCost),
        formatCurrency(metrics.totalLidCost),
        formatCurrency(metrics.totalAlufoilCost),
        formatCurrency(metrics.totalVacuumBagCost),
        formatCurrency(metrics.totalParchmentPaperCost),
        formatCurrency(metrics.totalCost),
      ]);

      rows.push([
        "Totals",
        formatNumber(payload.totals.totalBatches),
        formatNumber(payload.totals.completedBatches),
        formatNumber(payload.totals.finishedQuantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        formatCurrency(payload.totals.totalBottleCost),
        formatCurrency(payload.totals.totalLidCost),
        formatCurrency(payload.totals.totalAlufoilCost),
        formatCurrency(payload.totals.totalVacuumBagCost),
        formatCurrency(payload.totals.totalParchmentPaperCost),
        formatCurrency(payload.totals.totalCost),
      ]);

      return {
        name: detailName,
        data: [header, ...rows],
        columnWidths: [18, 12, 12, 30, 18, 18, 18, 20, 24, 22],
      };
    }
    case "labeling": {
      const entries = (Object.entries(payload.perProduct) as Array<[
        ProductKey,
        (LabelingMetrics & { totalCost: number }) | undefined
      ]>).filter((entry): entry is [ProductKey, LabelingMetrics & { totalCost: number }] => entry[1] !== undefined);

      const header = [
        "Product",
        "Batches",
        "Completed",
        "Sticker cost",
        "Shrink sleeve cost",
        "Neck tag cost",
        "Corrugated carton cost",
        "Total labeling cost",
      ];

      const rows = entries.map(([product, metrics]) => [
        productLabels[product],
        formatNumber(metrics.totalBatches),
        formatNumber(metrics.completedBatches),
        formatCurrency(metrics.totalStickerCost),
        formatCurrency(metrics.totalShrinkSleeveCost),
        formatCurrency(metrics.totalNeckTagCost),
        formatCurrency(metrics.totalCorrugatedCartonCost),
        formatCurrency(metrics.totalCost),
      ]);

      rows.push([
        "Totals",
        formatNumber(payload.totals.totalBatches),
        formatNumber(payload.totals.completedBatches),
        formatCurrency(payload.totals.totalStickerCost),
        formatCurrency(payload.totals.totalShrinkSleeveCost),
        formatCurrency(payload.totals.totalNeckTagCost),
        formatCurrency(payload.totals.totalCorrugatedCartonCost),
        formatCurrency(payload.totals.totalCost),
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

type ReportGenerationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: ReportStage;
};

export function ReportGenerationDialog({ open, onOpenChange, stage }: ReportGenerationDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>(todayString());
  const [report, setReport] = useState<DailyProductionReport | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    if (!open) {
      setReport(null);
      setSelectedDate(todayString());
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!selectedDate) {
      toast.error("Pick a date first.");
      return;
    }
    setIsGenerating(true);
    try {
      const data = await DataService.getDailyProductionReport(selectedDate);
      const hasRecords = (() => {
        switch (stage) {
          case "field":
            return data.totals.fieldCollection.drafts > 0;
          case "processing": {
            const totals = data.totals.processing;
            return (
              totals.completedBatches > 0 ||
              totals.totalBatches > 0 ||
              totals.totalOutput > 0 ||
              totals.totalInput > 0 ||
              totals.totalGasUsedKg > 0
            );
          }
          case "packaging":
            return data.totals.packaging.completedBatches > 0;
          case "labeling":
            return data.totals.labeling.completedBatches > 0;
          default:
            return false;
        }
      })();

      if (!hasRecords) {
        const messages: Record<ReportStage, string> = {
          field: "No submitted drafts found for the selected date.",
          processing: "No submitted processing batches found for the selected date.",
          packaging: "No completed packaging batches found for the selected date.",
          labeling: "No completed labeling batches found for the selected date.",
        };
        toast.error(messages[stage]);
        setReport(null);
        return;
      }

      setReport(data);
    } catch (error) {
      console.error("Failed to generate daily report", error);
      toast.error("Unable to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const stagePayload = useMemo<StageReportPayload | null>(() => {
    if (!report) {
      return null;
    }

    if (stage === "field") {
      const perProduct: ProductMetricsMap<FieldMetrics> = {
        sap: report.perProduct.sap.fieldCollection,
        treacle: report.perProduct.treacle.fieldCollection,
      };
      return {
        stage,
        date: report.date,
        generatedAt: report.generatedAt,
        perProduct,
        totals: report.totals.fieldCollection,
      } satisfies FieldStagePayload;
    }

    if (stage === "processing") {
      const basePerProduct: ProductMetricsMap<ProcessingMetrics> = {
        sap: report.perProduct.sap.processing,
        treacle: report.perProduct.treacle.processing,
      };
      return {
        stage,
        date: report.date,
        generatedAt: report.generatedAt,
        perProduct: basePerProduct,
        totals: report.totals.processing,
      } satisfies ProcessingStagePayload;
    }

    if (stage === "packaging") {
      const perProduct: ProductMetricsMap<PackagingMetrics & { totalCost: number }> = {
        sap: {
          ...report.perProduct.sap.packaging,
          totalCost:
            report.perProduct.sap.packaging.totalBottleCost +
            report.perProduct.sap.packaging.totalLidCost +
            report.perProduct.sap.packaging.totalAlufoilCost +
            report.perProduct.sap.packaging.totalVacuumBagCost +
            report.perProduct.sap.packaging.totalParchmentPaperCost,
        },
        treacle: {
          ...report.perProduct.treacle.packaging,
          totalCost:
            report.perProduct.treacle.packaging.totalBottleCost +
            report.perProduct.treacle.packaging.totalLidCost +
            report.perProduct.treacle.packaging.totalAlufoilCost +
            report.perProduct.treacle.packaging.totalVacuumBagCost +
            report.perProduct.treacle.packaging.totalParchmentPaperCost,
        },
      };

      const totals = report.totals.packaging;
      return {
        stage,
        date: report.date,
        generatedAt: report.generatedAt,
        perProduct,
        totals: {
          ...totals,
          totalCost:
            totals.totalBottleCost +
            totals.totalLidCost +
            totals.totalAlufoilCost +
            totals.totalVacuumBagCost +
            totals.totalParchmentPaperCost,
        },
      } satisfies PackagingStagePayload;
    }

    const perProduct: ProductMetricsMap<LabelingMetrics & { totalCost: number }> = {
      sap: {
        ...report.perProduct.sap.labeling,
        totalCost:
          report.perProduct.sap.labeling.totalStickerCost +
          report.perProduct.sap.labeling.totalShrinkSleeveCost +
          report.perProduct.sap.labeling.totalNeckTagCost +
          report.perProduct.sap.labeling.totalCorrugatedCartonCost,
      },
      treacle: {
        ...report.perProduct.treacle.labeling,
        totalCost:
          report.perProduct.treacle.labeling.totalStickerCost +
          report.perProduct.treacle.labeling.totalShrinkSleeveCost +
          report.perProduct.treacle.labeling.totalNeckTagCost +
          report.perProduct.treacle.labeling.totalCorrugatedCartonCost,
      },
    };

    const totals = report.totals.labeling;
    return {
      stage: "labeling",
      date: report.date,
      generatedAt: report.generatedAt,
      perProduct,
      totals: {
        ...totals,
        totalCost:
          totals.totalStickerCost +
          totals.totalShrinkSleeveCost +
          totals.totalNeckTagCost +
          totals.totalCorrugatedCartonCost,
      },
    } satisfies LabelingStagePayload;
  }, [report, stage]);

  const handleDownload = () => {
    if (!stagePayload) {
      toast.error("Generate the report before downloading.");
      return;
    }

    type ExcelRow = Array<string | number | null>;
    type ExcelMetric = { label: string; value: string; note?: string };

    const stageName = stagePayload.stage.charAt(0).toUpperCase() + stagePayload.stage.slice(1);
    const generatedAtDisplay = new Date(stagePayload.generatedAt).toLocaleString();

    const rows: ExcelRow[] = [];
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
    const sectionRows: number[] = [];
    const headerRows: number[] = [];
  const productHeaderRows: number[] = [];
  const metricRows: number[] = [];

    const padRow = (cells: ExcelRow): ExcelRow => {
      const copy = [...cells];
      while (copy.length < 3) {
        copy.push(null);
      }
      return copy.slice(0, 3);
    };

    const pushRow = (cells: ExcelRow) => {
      const index = rows.push(padRow(cells)) - 1;
      return index;
    };

    const addBlankRow = () => {
      pushRow([null, null, null]);
    };

    const addSectionHeader = (title: string) => {
      const rowIndex = pushRow([title, null, null]);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
      sectionRows.push(rowIndex);
      return rowIndex;
    };

    const addHeaderRow = (labels: [string, string, string]) => {
      const rowIndex = pushRow(labels);
      headerRows.push(rowIndex);
      return rowIndex;
    };

    const addProductHeader = (title: string) => {
      const rowIndex = pushRow([title, null, null]);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
      productHeaderRows.push(rowIndex);
      return rowIndex;
    };

    const addMetricRow = (metric: ExcelMetric) => {
      const rowIndex = pushRow([metric.label, metric.value, metric.note ?? ""]);
      metricRows.push(rowIndex);
      return rowIndex;
    };

    const addMetricRows = (metrics: ExcelMetric[]) => {
      metrics.forEach((metric) => addMetricRow(metric));
    };

    const addTitleRow = (title: string) => {
      const rowIndex = pushRow([title, null, null]);
      merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 2 } });
      return rowIndex;
    };

    // Title & basic metadata
    const titleRowIndex = addTitleRow(stageMeta[stage].title);
    addBlankRow();
    addMetricRow({ label: "Report date", value: stagePayload.date });
    addMetricRow({ label: "Generated at", value: generatedAtDisplay });
    addBlankRow();

    // Summary section
    const summaryCards = topCards
      .filter((card) => card.key !== "date" && card.key !== "generatedAt")
      .map<ExcelMetric>((card) => ({ label: card.label, value: card.value, note: card.helper ?? "" }));

    if (summaryCards.length > 0) {
      addSectionHeader("Summary");
      addHeaderRow(["Metric", "Value", "Notes"]);
      addMetricRows(summaryCards);
      addBlankRow();
    }

    // Per-product sections and totals
    const productSections: Array<{ title: string; metrics: ExcelMetric[] }> = [];
    let totalsMetrics: ExcelMetric[] = [];

    switch (stagePayload.stage) {
      case "field": {
        const entries = Object.entries(stagePayload.perProduct) as Array<[ProductKey, FieldMetrics]>;
        entries.forEach(([product, metrics]) => {
          const unit = "L";
          const draftIdDisplay = metrics.draftIds && metrics.draftIds.length > 0 ? metrics.draftIds.join(", ") : "—";
          productSections.push({
            title: productLabels[product],
            metrics: [
              { label: "Draft ID", value: draftIdDisplay },
              { label: "Buckets", value: formatNumber(metrics.buckets) },
              {
                label: "Quantity",
                value: formatNumber(metrics.quantity, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                note: unit,
              },
            ],
          });
        });

        totalsMetrics = [
          {
            label: "Draft ID",
            value: stagePayload.totals.draftIds && stagePayload.totals.draftIds.length > 0
              ? stagePayload.totals.draftIds.join(", ")
              : "—",
          },
          { label: "Drafts", value: formatNumber(stagePayload.totals.drafts) },
          { label: "Buckets", value: formatNumber(stagePayload.totals.buckets) },
          {
            label: "Quantity",
            value: formatNumber(stagePayload.totals.quantity, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            note: "L",
          },
        ];
        break;
      }
      case "processing": {
        const entries = Object.entries(stagePayload.perProduct) as Array<[ProductKey, ProcessingMetrics]>;
        entries.forEach(([product, metrics]) => {
          const unit = productUnits[product];
          productSections.push({
            title: productLabels[product],
            metrics: [
              {
                label: "Input",
                value: formatNumber(metrics.totalInput, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                note: unit,
              },
              {
                label: "Output",
                value: formatNumber(metrics.totalOutput, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                note: unit,
              },
              {
                label: "Used gas (kg)",
                value: formatNumber(metrics.totalGasUsedKg, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              },
            ],
          });
        });

        totalsMetrics = [
          {
            label: "Input",
            value: formatNumber(stagePayload.totals.totalInput, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            note: "Sap in L, Treacle in kg",
          },
          {
            label: "Output",
            value: formatNumber(stagePayload.totals.totalOutput, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            note: "Sap in L, Treacle in kg",
          },
          {
            label: "Used gas (kg)",
            value: formatNumber(stagePayload.totals.totalGasUsedKg, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
          },
        ];
        break;
      }
      case "packaging": {
        const entries = Object.entries(stagePayload.perProduct) as Array<
          [ProductKey, PackagingMetrics & { totalCost: number }]
        >;
        entries.forEach(([product, metrics]) => {
          const unit = productUnits[product];
          productSections.push({
            title: productLabels[product],
            metrics: [
              { label: "Batches", value: formatNumber(metrics.totalBatches) },
              { label: "Completed", value: formatNumber(metrics.completedBatches) },
              {
                label: "Finished quantity",
                value: formatNumber(metrics.finishedQuantity, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                note: unit,
              },
              { label: "Bottle cost", value: formatCurrency(metrics.totalBottleCost) },
              { label: "Lid cost", value: formatCurrency(metrics.totalLidCost) },
              { label: "Alufoil cost", value: formatCurrency(metrics.totalAlufoilCost) },
              { label: "Vacuum bag cost", value: formatCurrency(metrics.totalVacuumBagCost) },
              { label: "Parchment paper cost", value: formatCurrency(metrics.totalParchmentPaperCost) },
              { label: "Total packaging cost", value: formatCurrency(metrics.totalCost) },
            ],
          });
        });

        totalsMetrics = [
          { label: "Batches", value: formatNumber(stagePayload.totals.totalBatches) },
          { label: "Completed", value: formatNumber(stagePayload.totals.completedBatches) },
          {
            label: "Finished quantity",
            value: formatNumber(stagePayload.totals.finishedQuantity, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            note: "Sap in L, Treacle in kg",
          },
          { label: "Bottle cost", value: formatCurrency(stagePayload.totals.totalBottleCost) },
          { label: "Lid cost", value: formatCurrency(stagePayload.totals.totalLidCost) },
          { label: "Alufoil cost", value: formatCurrency(stagePayload.totals.totalAlufoilCost) },
          { label: "Vacuum bag cost", value: formatCurrency(stagePayload.totals.totalVacuumBagCost) },
          { label: "Parchment paper cost", value: formatCurrency(stagePayload.totals.totalParchmentPaperCost) },
          { label: "Total packaging cost", value: formatCurrency(stagePayload.totals.totalCost) },
        ];
        break;
      }
      case "labeling": {
        const entries = Object.entries(stagePayload.perProduct) as Array<
          [ProductKey, LabelingMetrics & { totalCost: number }]
        >;
        entries.forEach(([product, metrics]) => {
          productSections.push({
            title: productLabels[product],
            metrics: [
              { label: "Batches", value: formatNumber(metrics.totalBatches) },
              { label: "Completed", value: formatNumber(metrics.completedBatches) },
              { label: "Sticker cost", value: formatCurrency(metrics.totalStickerCost) },
              { label: "Shrink sleeve cost", value: formatCurrency(metrics.totalShrinkSleeveCost) },
              { label: "Neck tag cost", value: formatCurrency(metrics.totalNeckTagCost) },
              { label: "Corrugated carton cost", value: formatCurrency(metrics.totalCorrugatedCartonCost) },
              { label: "Total labeling cost", value: formatCurrency(metrics.totalCost) },
            ],
          });
        });

        totalsMetrics = [
          { label: "Batches", value: formatNumber(stagePayload.totals.totalBatches) },
          { label: "Completed", value: formatNumber(stagePayload.totals.completedBatches) },
          { label: "Sticker cost", value: formatCurrency(stagePayload.totals.totalStickerCost) },
          { label: "Shrink sleeve cost", value: formatCurrency(stagePayload.totals.totalShrinkSleeveCost) },
          { label: "Neck tag cost", value: formatCurrency(stagePayload.totals.totalNeckTagCost) },
          { label: "Corrugated carton cost", value: formatCurrency(stagePayload.totals.totalCorrugatedCartonCost) },
          { label: "Total labeling cost", value: formatCurrency(stagePayload.totals.totalCost) },
        ];
        break;
      }
    }

    if (productSections.length > 0) {
      addSectionHeader("Per product metrics");
      productSections.forEach((section, index) => {
        if (index === 0) {
          addBlankRow();
        }
        addProductHeader(section.title);
        addHeaderRow(["Metric", "Value", "Notes"]);
        addMetricRows(section.metrics);
        addBlankRow();
      });
    }

    if (totalsMetrics.length > 0) {
      addSectionHeader("Totals");
      addHeaderRow(["Metric", "Value", "Notes"]);
      addMetricRows(totalsMetrics);
    }

    const worksheet = utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 38 }];
    worksheet["!merges"] = merges;

    type ExcelCellStyle = NonNullable<CellObject["s"]>;
    const applyStyle = (sheet: WorkSheet, rowIndex: number, colIndex: number, style: Partial<ExcelCellStyle>) => {
      const address = utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = sheet[address] as CellObject | undefined;
      if (!cell) {
        return;
      }
      const currentStyle = (cell.s ?? {}) as ExcelCellStyle;
      cell.s = { ...currentStyle, ...(style as ExcelCellStyle) };
    };

    const sectionHeaderStyle: Partial<ExcelCellStyle> = {
      font: { bold: true, sz: 12, color: { rgb: "1F2937" } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "E5E7EB" } },
    };

    const titleStyle: Partial<ExcelCellStyle> = {
      font: { bold: true, sz: 14, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "center" },
    };

    const tableHeaderStyle: Partial<ExcelCellStyle> = {
      font: { bold: true, color: { rgb: "111827" } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "F3F4F6" } },
      border: {
        top: { style: "thin", color: { rgb: "D1D5DB" } },
        bottom: { style: "thin", color: { rgb: "D1D5DB" } },
        left: { style: "thin", color: { rgb: "D1D5DB" } },
        right: { style: "thin", color: { rgb: "D1D5DB" } },
      },
    };

    const productHeaderStyle: Partial<ExcelCellStyle> = {
      font: { bold: true, color: { rgb: "1F2937" } },
      alignment: { horizontal: "left", vertical: "center" },
      fill: { patternType: "solid", fgColor: { rgb: "E0F2FE" } },
    };

    const metricLabelStyle: Partial<ExcelCellStyle> = {
      font: { bold: true },
      alignment: { horizontal: "left", vertical: "center" },
    };

    applyStyle(worksheet, titleRowIndex, 0, titleStyle);

    sectionRows.forEach((rowIndex) => {
      applyStyle(worksheet, rowIndex, 0, sectionHeaderStyle);
    });

    headerRows.forEach((rowIndex) => {
      for (let col = 0; col < 3; col += 1) {
        applyStyle(worksheet, rowIndex, col, tableHeaderStyle);
      }
    });

    productHeaderRows.forEach((rowIndex) => {
      applyStyle(worksheet, rowIndex, 0, productHeaderStyle);
    });

    metricRows.forEach((rowIndex) => {
      applyStyle(worksheet, rowIndex, 0, metricLabelStyle);
    });

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, stageName);
    const detailSheetConfig = buildDetailSheet(stagePayload, stageName);
    if (detailSheetConfig) {
      const { name, data, columnWidths } = detailSheetConfig;
      const detailSheet = utils.aoa_to_sheet(data);
      if (columnWidths.length > 0) {
        detailSheet["!cols"] = columnWidths.map((width) => ({ wch: width }));
      }
      if (data.length > 1) {
        detailSheet["!autofilter"] = {
          ref: utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: data[0].length - 1 } }),
        };
      }
      for (let col = 0; col < (data[0]?.length ?? 0); col += 1) {
        applyStyle(detailSheet, 0, col, tableHeaderStyle);
      }
      if (data.length > 1 && data[data.length - 1]?.[0] === "Totals") {
        applyStyle(detailSheet, data.length - 1, 0, metricLabelStyle);
      }
      utils.book_append_sheet(workbook, detailSheet, name);
    }
    writeFileXLSX(workbook, `${stagePayload.stage}-report-${stagePayload.date}.xlsx`);
    toast.success("Report Excel downloaded.");
  };

  const topCards = useMemo(() => {
    if (!stagePayload) {
      return [] as Array<{ key: string; label: string; value: string; helper?: string }>;
    }

    const cards: Array<{ key: string; label: string; value: string; helper?: string }> = [
      { key: "date", label: "Report date", value: stagePayload.date },
      {
        key: "generatedAt",
        label: "Generated at",
        value: new Date(stagePayload.generatedAt).toLocaleString(),
      },
    ];

    switch (stagePayload.stage) {
      case "field":
        {
          const draftIdDisplay =
            stagePayload.totals.draftIds && stagePayload.totals.draftIds.length > 0
              ? stagePayload.totals.draftIds.join(", ")
              : "—";
        cards.push(
          {
              key: "draftIds",
              label: "Draft ID",
              value: draftIdDisplay,
          },
          {
            key: "buckets",
            label: "Total buckets",
            value: formatNumber(stagePayload.totals.buckets),
          }
        );
        }
        break;
      case "processing":
        cards.push(
          {
            key: "completedBatches",
            label: "Complete batches",
            value: formatNumber(stagePayload.totals.completedBatches),
          }
        );
        break;
      case "packaging":
        cards.push(
          {
            key: "batches",
            label: "Packaging batches",
            value: formatNumber(stagePayload.totals.totalBatches),
            helper: `Completed: ${formatNumber(stagePayload.totals.completedBatches)}`,
          },
          {
            key: "quantity",
            label: "Finished quantity",
            value: formatNumber(stagePayload.totals.finishedQuantity, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            helper: `Total packaging cost: ${formatCurrency(stagePayload.totals.totalCost)}`,
          }
        );
        break;
      case "labeling":
        cards.push(
          {
            key: "batches",
            label: "Labeling batches",
            value: formatNumber(stagePayload.totals.totalBatches),
            helper: `Completed: ${formatNumber(stagePayload.totals.completedBatches)}`,
          },
          {
            key: "cost",
            label: "Total labeling cost",
            value: formatCurrency(stagePayload.totals.totalCost),
            helper: `Sticker cost: ${formatCurrency(stagePayload.totals.totalStickerCost)}`,
          }
        );
        break;
    }

    return cards;
  }, [stagePayload]);

  const stageConfig = stageMeta[stage];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{stageConfig.title}</DialogTitle>
          <DialogDescription>{stageConfig.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="daily-report-date">Report date</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="daily-report-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  max={todayString()}
                />
                <Button type="button" variant="outline" onClick={() => setSelectedDate(todayString())}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Today
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={isGenerating}>
                <RefreshCcw className={isGenerating ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                {isGenerating ? "Generating" : "Generate"}
              </Button>
              <Button type="button" onClick={handleDownload} disabled={!stagePayload}>
                <Download className="mr-2 h-4 w-4" /> Download Excel
              </Button>
            </div>
          </div>

          {isGenerating && !stagePayload ? (
            <div className="flex items-center justify-center rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing report…
            </div>
          ) : null}

          {stagePayload ? (
            <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1 sm:pr-2">
              <section className="grid gap-3 sm:grid-cols-4">
                {topCards.map((card) => (
                  <SummaryStat key={card.key} label={card.label} value={card.value} helper={card.helper} />
                ))}
              </section>

              {renderStageSections(stagePayload)}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderStageSections(payload: StageReportPayload) {
  switch (payload.stage) {
    case "field":
      return (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Per product metrics</h3>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Product</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Buckets</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {(Object.entries(payload.perProduct) as Array<[ProductKey, FieldMetrics]>).map(([product, metrics], index) => {
                  const unit = "L";
                  const rowClass = index % 2 === 0 ? "bg-card" : "bg-muted/30";
                  return (
                    <tr key={product} className={`${rowClass} border-b last:border-b-0 border-border/70`}>
                      <td className="px-4 py-3 font-medium text-foreground">{productLabels[product]}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatNumber(metrics.buckets)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatNumber(metrics.quantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      );
    case "processing":
      return (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Per product metrics</h3>
          <div className="space-y-4">
            {(Object.entries(payload.perProduct) as Array<[ProductKey, ProcessingMetrics]>).map(([product, metrics]) => {
              const unit = productUnits[product];
              return (
                <div key={product} className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Product lane</p>
                      <p className="text-lg font-semibold text-foreground">{productLabels[product]}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Metric
                      label={`Input (${unit})`}
                      value={formatNumber(metrics.totalInput, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    />
                    <Metric
                      label={`Output (${unit})`}
                      value={formatNumber(metrics.totalOutput, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    />
                    <Metric
                      label="Used gas (kg)"
                      value={formatNumber(metrics.totalGasUsedKg, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    case "packaging":
      return (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Per product metrics</h3>
          <div className="space-y-4">
            {(Object.entries(payload.perProduct) as Array<
              [ProductKey, PackagingMetrics & { totalCost: number }]
            >).map(([product, metrics]) => {
              const unit = productUnits[product];
              return (
                <div key={product} className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Product lane</p>
                      <p className="text-lg font-semibold text-foreground">{productLabels[product]}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:text-sm">
                      <span>Batches: {formatNumber(metrics.totalBatches)}</span>
                      <span>Completed: {formatNumber(metrics.completedBatches)}</span>
                      <span>
                        Finished: {formatNumber(metrics.finishedQuantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {unit}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Metric label="Bottle cost" value={formatCurrency(metrics.totalBottleCost)} />
                    <Metric label="Lid cost" value={formatCurrency(metrics.totalLidCost)} />
                    <Metric label="Alufoil cost" value={formatCurrency(metrics.totalAlufoilCost)} />
                    <Metric label="Vacuum bag cost" value={formatCurrency(metrics.totalVacuumBagCost)} />
                    <Metric label="Parchment paper cost" value={formatCurrency(metrics.totalParchmentPaperCost)} />
                    <Metric label="Total packaging cost" value={formatCurrency(metrics.totalCost)} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    case "labeling":
      return (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Per product metrics</h3>
          <div className="space-y-4">
            {(Object.entries(payload.perProduct) as Array<
              [ProductKey, LabelingMetrics & { totalCost: number }]
            >).map(([product, metrics]) => {
              return (
                <div key={product} className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Product lane</p>
                      <p className="text-lg font-semibold text-foreground">{productLabels[product]}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:text-sm">
                      <span>Batches: {formatNumber(metrics.totalBatches)}</span>
                      <span>Completed: {formatNumber(metrics.completedBatches)}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Metric label="Sticker cost" value={formatCurrency(metrics.totalStickerCost)} />
                    <Metric label="Shrink sleeve cost" value={formatCurrency(metrics.totalShrinkSleeveCost)} />
                    <Metric label="Neck tag cost" value={formatCurrency(metrics.totalNeckTagCost)} />
                    <Metric label="Corrugated carton cost" value={formatCurrency(metrics.totalCorrugatedCartonCost)} />
                    <Metric label="Total labeling cost" value={formatCurrency(metrics.totalCost)} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
  }
}

type MetricProps = {
  label: string;
  value: string;
};

const Metric = ({ label, value }: MetricProps) => (
  <div className="rounded-md border bg-muted/20 px-3 py-2">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm font-medium text-foreground">{value}</p>
  </div>
);

type SummaryStatProps = {
  label: string;
  value: string;
  helper?: string;
};

const SummaryStat = ({ label, value, helper }: SummaryStatProps) => (
  <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
    <p className="text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
  </div>
);
