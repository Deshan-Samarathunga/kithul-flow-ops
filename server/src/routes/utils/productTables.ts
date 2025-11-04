export const SUPPORTED_PRODUCTS = ["treacle", "jaggery"] as const;
export type ProductSlug = (typeof SUPPORTED_PRODUCTS)[number];

const TABLES = {
  drafts: {
    treacle: "field_collection_drafts",
    jaggery: "field_collection_drafts",
  },
  cans: {
    treacle: "sap_cans", // SAP cans collected in field, processed to treacle
    jaggery: "treacle_cans", // Treacle cans collected in field, processed to jaggery
  },
  processingBatches: {
    treacle: "treacle_processing_batches", // SAP -> Treacle (in-house)
    jaggery: "jaggery_processing_batches", // Treacle -> Jaggery
  },
  processingBatchCans: {
    treacle: "treacle_processing_batch_cans",
    jaggery: "jaggery_processing_batch_cans",
  },
  packagingBatches: {
    treacle: "treacle_packaging_batches", // For in-house treacle
    jaggery: "jaggery_packaging_batches",
  },
  labelingBatches: {
    treacle: "treacle_labeling_batches", // For in-house treacle
    jaggery: "jaggery_labeling_batches",
  },
} as const satisfies Record<string, Record<ProductSlug, string>>;

export const getTableName = <K extends keyof typeof TABLES>(key: K, product: ProductSlug) =>
  TABLES[key][product];

export const normalizeProduct = (value: unknown): ProductSlug | null => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const normalized = value.toLowerCase();
  return (SUPPORTED_PRODUCTS as readonly string[]).includes(normalized)
    ? (normalized as ProductSlug)
    : null;
};

export const isSupportedProduct = (value: unknown): value is ProductSlug =>
  normalizeProduct(value) !== null;
