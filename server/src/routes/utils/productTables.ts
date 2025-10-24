export const SUPPORTED_PRODUCTS = ["sap", "treacle"] as const;
export type ProductSlug = (typeof SUPPORTED_PRODUCTS)[number];

const TABLES = {
  drafts: {
    sap: "sap_drafts",
    treacle: "treacle_drafts",
  },
  buckets: {
    sap: "sap_buckets",
    treacle: "treacle_buckets",
  },
  centerCompletions: {
    sap: "sap_center_completions",
    treacle: "treacle_center_completions",
  },
  processingBatches: {
    sap: "sap_processing_batches",
    treacle: "treacle_processing_batches",
  },
  processingBatchBuckets: {
    sap: "sap_processing_batch_buckets",
    treacle: "treacle_processing_batch_buckets",
  },
  packagingBatches: {
    sap: "sap_packaging_batches",
    treacle: "treacle_packaging_batches",
  },
  labelingBatches: {
    sap: "sap_labeling_batches",
    treacle: "treacle_labeling_batches",
  },
} as const satisfies Record<string, Record<ProductSlug, string>>;

export const getTableName = <K extends keyof typeof TABLES>(key: K, product: ProductSlug) => TABLES[key][product];

export const normalizeProduct = (value: unknown): ProductSlug | null => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const normalized = value.toLowerCase();
  return (SUPPORTED_PRODUCTS as readonly string[]).includes(normalized) ? (normalized as ProductSlug) : null;
};

export const isSupportedProduct = (value: unknown): value is ProductSlug => normalizeProduct(value) !== null;
