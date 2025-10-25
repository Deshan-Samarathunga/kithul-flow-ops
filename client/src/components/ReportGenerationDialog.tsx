import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCcw, Download, CalendarDays } from "lucide-react";
import jsPDF from "jspdf";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import DataService from "@/lib/dataService";
import type { DailyProductionReport } from "@/lib/apiClient";

type ReportStage = "field" | "processing" | "packaging" | "labeling";
type ProductKey = "sap" | "treacle";

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
    description: "Summarise processing throughput, output, and melting costs for the chosen date.",
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
  perProduct: Record<ProductKey, FieldMetrics>;
  totals: FieldTotals;
};

type ProcessingStagePayload = {
  stage: "processing";
  date: string;
  generatedAt: string;
  perProduct: Record<ProductKey, ProcessingMetrics>;
  totals: ProcessingTotals;
};

type PackagingStagePayload = {
  stage: "packaging";
  date: string;
  generatedAt: string;
  perProduct: Record<ProductKey, PackagingMetrics & { totalCost: number }>;
  totals: PackagingTotals & { totalCost: number };
};

type LabelingStagePayload = {
  stage: "labeling";
  date: string;
  generatedAt: string;
  perProduct: Record<ProductKey, LabelingMetrics & { totalCost: number }>;
  totals: LabelingTotals & { totalCost: number };
};

type StageReportPayload =
  | FieldStagePayload
  | ProcessingStagePayload
  | PackagingStagePayload
  | LabelingStagePayload;

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
      const perProduct: Record<ProductKey, FieldMetrics> = {
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
      const perProduct: Record<ProductKey, ProcessingMetrics> = {
        sap: report.perProduct.sap.processing,
        treacle: report.perProduct.treacle.processing,
      };
      return {
        stage,
        date: report.date,
        generatedAt: report.generatedAt,
        perProduct,
        totals: report.totals.processing,
      } satisfies ProcessingStagePayload;
    }

    if (stage === "packaging") {
      const perProduct: Record<ProductKey, PackagingMetrics & { totalCost: number }> = {
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

    const perProduct: Record<ProductKey, LabelingMetrics & { totalCost: number }> = {
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

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    let cursorY = 20;

    const ensureVerticalSpace = (required = 6) => {
      if (cursorY + required > pageHeight - 12) {
        doc.addPage();
        cursorY = 20;
      }
    };

    const addLine = (text: string) => {
      ensureVerticalSpace();
      doc.text(text, marginX, cursorY);
      cursorY += 6;
    };

    const addBlankLine = () => {
      ensureVerticalSpace();
      cursorY += 2;
    };

    const addSectionTitle = (title: string) => {
      ensureVerticalSpace(10);
      doc.setFontSize(13);
      doc.text(title, marginX, cursorY);
      cursorY += 8;
      doc.setFontSize(11);
    };

    const addProductHeading = (title: string) => {
      ensureVerticalSpace(8);
      doc.setFontSize(12);
      doc.text(title, marginX, cursorY);
      cursorY += 7;
      doc.setFontSize(11);
    };

    doc.setFontSize(16);
    doc.text(stageMeta[stage].title, marginX, cursorY);
    cursorY += 10;
    doc.setFontSize(11);

    addLine(`Report date: ${stagePayload.date}`);
    addLine(`Generated at: ${new Date(stagePayload.generatedAt).toLocaleString()}`);
    addBlankLine();

    const summaryCards = topCards.filter((card) => card.key !== "date" && card.key !== "generatedAt");
    if (summaryCards.length > 0) {
      addSectionTitle("Summary");
      summaryCards.forEach((card) => {
        const text = card.helper ? `${card.label}: ${card.value} (${card.helper})` : `${card.label}: ${card.value}`;
        addLine(text);
      });
      addBlankLine();
    }

    addSectionTitle("Per product metrics");

    switch (stagePayload.stage) {
      case "field": {
        Object.entries(stagePayload.perProduct).forEach(([key, metrics]) => {
          const product = key as ProductKey;
          const unit = productUnits[product];
          addProductHeading(productLabels[product]);
          addLine(`• Drafts: ${formatNumber(metrics.drafts)}`);
          addLine(`• Buckets: ${formatNumber(metrics.buckets)}`);
          addLine(
            `• Quantity: ${formatNumber(metrics.quantity, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} ${unit}`
          );
          addBlankLine();
        });
        break;
      }
      case "processing": {
        Object.entries(stagePayload.perProduct).forEach(([key, metrics]) => {
          const product = key as ProductKey;
          const unit = productUnits[product];
          addProductHeading(productLabels[product]);
          addLine(`• Batches: ${formatNumber(metrics.totalBatches)}`);
          addLine(`• Completed: ${formatNumber(metrics.completedBatches)}`);
          addLine(
            `• Input: ${formatNumber(metrics.totalInput, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} ${unit}`
          );
          addLine(
            `• Output: ${formatNumber(metrics.totalOutput, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} ${unit}`
          );
          addLine(`• Gas cost: ${formatCurrency(metrics.totalGasCost)}`);
          addLine(`• Labor cost: ${formatCurrency(metrics.totalLaborCost)}`);
          addBlankLine();
        });
        break;
      }
      case "packaging": {
        Object.entries(stagePayload.perProduct).forEach(([key, metrics]) => {
          const product = key as ProductKey;
          const unit = productUnits[product];
          addProductHeading(productLabels[product]);
          addLine(`• Batches: ${formatNumber(metrics.totalBatches)}`);
          addLine(`• Completed: ${formatNumber(metrics.completedBatches)}`);
          addLine(
            `• Finished quantity: ${formatNumber(metrics.finishedQuantity, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} ${unit}`
          );
          addLine(`• Bottle cost: ${formatCurrency(metrics.totalBottleCost)}`);
          addLine(`• Lid cost: ${formatCurrency(metrics.totalLidCost)}`);
          addLine(`• Alufoil cost: ${formatCurrency(metrics.totalAlufoilCost)}`);
          addLine(`• Vacuum bag cost: ${formatCurrency(metrics.totalVacuumBagCost)}`);
          addLine(`• Parchment paper cost: ${formatCurrency(metrics.totalParchmentPaperCost)}`);
          addLine(`• Total packaging cost: ${formatCurrency(metrics.totalCost)}`);
          addBlankLine();
        });
        break;
      }
      case "labeling": {
        Object.entries(stagePayload.perProduct).forEach(([key, metrics]) => {
          const product = key as ProductKey;
          addProductHeading(productLabels[product]);
          addLine(`• Batches: ${formatNumber(metrics.totalBatches)}`);
          addLine(`• Completed: ${formatNumber(metrics.completedBatches)}`);
          addLine(`• Sticker cost: ${formatCurrency(metrics.totalStickerCost)}`);
          addLine(`• Shrink sleeve cost: ${formatCurrency(metrics.totalShrinkSleeveCost)}`);
          addLine(`• Neck tag cost: ${formatCurrency(metrics.totalNeckTagCost)}`);
          addLine(`• Corrugated carton cost: ${formatCurrency(metrics.totalCorrugatedCartonCost)}`);
          addLine(`• Total labeling cost: ${formatCurrency(metrics.totalCost)}`);
          addBlankLine();
        });
        break;
      }
    }

    doc.save(`${stagePayload.stage}-report-${stagePayload.date}.pdf`);
    toast.success("Report PDF downloaded.");
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
        cards.push(
          { key: "drafts", label: "Total drafts", value: formatNumber(stagePayload.totals.drafts) },
          {
            key: "buckets",
            label: "Total buckets",
            value: formatNumber(stagePayload.totals.buckets),
            helper: `Combined quantity: ${formatNumber(stagePayload.totals.quantity, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} (Sap in L, Treacle in kg)`,
          }
        );
        break;
      case "processing":
        cards.push(
          {
            key: "batches",
            label: "Processing batches",
            value: formatNumber(stagePayload.totals.totalBatches),
            helper: `Completed: ${formatNumber(stagePayload.totals.completedBatches)}`,
          },
          {
            key: "output",
            label: "Combined output",
            value: formatNumber(stagePayload.totals.totalOutput, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
            helper: `Input: ${formatNumber(stagePayload.totals.totalInput, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} (Sap in L, Treacle in kg)`,
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
                <Download className="mr-2 h-4 w-4" /> Download PDF
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
          <div className="space-y-4">
            {Object.entries(payload.perProduct).map(([key, metrics]) => {
              const product = key as ProductKey;
              const unit = productUnits[product];
              return (
                <div key={product} className="rounded-xl border bg-card p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Product lane</p>
                      <p className="text-lg font-semibold text-foreground">{productLabels[product]}</p>
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-sm">
                      Collected {formatNumber(metrics.quantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {unit}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Metric label="Drafts" value={formatNumber(metrics.drafts)} />
                    <Metric label="Buckets" value={formatNumber(metrics.buckets)} />
                    <Metric
                      label={`Quantity (${unit})`}
                      value={formatNumber(metrics.quantity, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );
    case "processing":
      return (
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Per product metrics</h3>
          <div className="space-y-4">
            {Object.entries(payload.perProduct).map(([key, metrics]) => {
              const product = key as ProductKey;
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
                    <Metric label="Gas cost" value={formatCurrency(metrics.totalGasCost)} />
                    <Metric label="Labor cost" value={formatCurrency(metrics.totalLaborCost)} />
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
            {Object.entries(payload.perProduct).map(([key, metrics]) => {
              const product = key as ProductKey;
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
            {Object.entries(payload.perProduct).map(([key, metrics]) => {
              const product = key as ProductKey;
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
