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

function mapPackagingRow(row: any) {
	return {
		id: row.packaging_id as string,
		packagingId: row.packaging_id as string,
		processingBatchId: row.batch_id as string,
		batchNumber: row.batch_number as string,
		productType: row.product_type as string,
		scheduledDate:
			row.scheduled_date instanceof Date
				? row.scheduled_date.toISOString()
				: (row.scheduled_date as string | null),
		startedAt:
			row.started_at instanceof Date
				? row.started_at.toISOString()
				: (row.started_at as string | null),
		updatedAt:
			row.packaging_updated_at instanceof Date
				? row.packaging_updated_at.toISOString()
				: (row.packaging_updated_at as string | null),
		packagingStatus: row.packaging_status as string,
		processingStatus: row.processing_status as string,
		notes: row.packaging_notes as string | null,
		bucketCount: Number(row.bucket_count ?? 0),
		totalQuantity: Number(row.total_quantity ?? 0),
		totalSapOutput: row.total_sap_output !== null ? Number(row.total_sap_output) : null,
		finishedQuantity: row.finished_quantity !== null ? Number(row.finished_quantity) : null,
		bottleCost: row.bottle_cost !== null ? Number(row.bottle_cost) : null,
		lidCost: row.lid_cost !== null ? Number(row.lid_cost) : null,
		alufoilCost: row.alufoil_cost !== null ? Number(row.alufoil_cost) : null,
		vacuumBagCost: row.vacuum_bag_cost !== null ? Number(row.vacuum_bag_cost) : null,
		parchmentPaperCost:
			row.parchment_paper_cost !== null ? Number(row.parchment_paper_cost) : null,
	};
}

const PACKAGING_STATUSES = ["pending", "in-progress", "completed", "on-hold"] as const;

const numericCost = z
	.number()
	.min(0, "Cost must be greater than or equal to 0")
	.nullable()
	.optional();

const updatePackagingSchema = z.object({
	status: z.enum(PACKAGING_STATUSES).optional(),
	notes: z
		.string()
		.trim()
		.max(2000, "Notes must be 2000 characters or fewer")
		.optional(),
	finishedQuantity: z
		.number()
		.min(0, "Finished quantity must be greater than or equal to 0")
		.optional(),
	bottleCost: numericCost,
	lidCost: numericCost,
	alufoilCost: numericCost,
	vacuumBagCost: numericCost,
	parchmentPaperCost: numericCost,
});

async function fetchPackagingBatchByPackagingId(packagingId: string) {
  const context = await resolvePackagingContext(packagingId);
  if (!context) {
    return null;
  }

  const query = `
    SELECT
      pkg.packaging_id,
      pkg.status AS packaging_status,
      pkg.started_at,
      pkg.updated_at AS packaging_updated_at,
      pkg.notes AS packaging_notes,
      pkg.bottle_cost,
      pkg.lid_cost,
      pkg.alufoil_cost,
      pkg.vacuum_bag_cost,
      pkg.parchment_paper_cost,
      pkg.finished_quantity,
      pb.id AS processing_pk,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status AS processing_status,
      pb.scheduled_date,
      pb.total_sap_output,
      COALESCE(SUM(b.quantity), 0) AS total_quantity,
      COUNT(pbb.bucket_id) AS bucket_count
    FROM ${context.packagingTable} pkg
    JOIN ${context.processingBatchTable} pb ON pb.id = pkg.processing_batch_id
    LEFT JOIN ${context.batchBucketTable} pbb ON pbb.processing_batch_id = pb.id
    LEFT JOIN ${context.bucketTable} b ON b.id = pbb.bucket_id
    WHERE pkg.packaging_id = $1
    GROUP BY
      pkg.packaging_id,
      pkg.status,
      pkg.started_at,
      pkg.updated_at,
      pkg.notes,
      pkg.bottle_cost,
      pkg.lid_cost,
      pkg.alufoil_cost,
      pkg.vacuum_bag_cost,
      pkg.parchment_paper_cost,
      pkg.finished_quantity,
      pb.id,
      pb.batch_id,
      pb.batch_number,
      pb.product_type,
      pb.status,
      pb.scheduled_date,
      pb.total_sap_output
  `;

  const { rows } = await pool.query(query, [packagingId]);
  if (rows.length === 0) {
    return null;
  }
	return mapPackagingRow(rows[0]);
}

type PackagingContext = {
	productType: ProductSlug;
	packagingTable: string;
	processingBatchTable: string;
	batchBucketTable: string;
	bucketTable: string;
	row: any;
};

async function resolvePackagingContext(packagingId: string): Promise<PackagingContext | null> {
	for (const productType of SUPPORTED_PRODUCTS) {
		const packagingTable = getTableName("packagingBatches", productType);
		const { rows } = await pool.query(`SELECT * FROM ${packagingTable} WHERE packaging_id = $1`, [packagingId]);
		if (rows.length > 0) {
			return {
				productType,
				packagingTable,
				processingBatchTable: getTableName("processingBatches", productType),
				batchBucketTable: getTableName("processingBatchBuckets", productType),
				bucketTable: getTableName("buckets", productType),
				row: rows[0],
			};
		}
	}
	return null;
}

async function fetchPackagingSummaries(productType: ProductSlug) {
	const packagingTable = getTableName("packagingBatches", productType);
	const processingBatchTable = getTableName("processingBatches", productType);
	const batchBucketTable = getTableName("processingBatchBuckets", productType);
	const bucketTable = getTableName("buckets", productType);

	const query = `
		SELECT
			pkg.packaging_id,
			pkg.status AS packaging_status,
			pkg.started_at,
			pkg.updated_at AS packaging_updated_at,
			pb.batch_id,
			pb.batch_number,
			pb.product_type,
			pb.status AS processing_status,
			pb.scheduled_date,
			pb.total_sap_output,
			pkg.notes AS packaging_notes,
			pkg.bottle_cost,
			pkg.lid_cost,
			pkg.alufoil_cost,
			pkg.vacuum_bag_cost,
			pkg.parchment_paper_cost,
			pkg.finished_quantity,
			COALESCE(SUM(b.quantity), 0) AS total_quantity,
			COUNT(pbb.bucket_id) AS bucket_count
		FROM ${packagingTable} pkg
		JOIN ${processingBatchTable} pb ON pb.id = pkg.processing_batch_id
		LEFT JOIN ${batchBucketTable} pbb ON pbb.processing_batch_id = pb.id
		LEFT JOIN ${bucketTable} b ON b.id = pbb.bucket_id
		GROUP BY
			pkg.packaging_id,
			pkg.status,
			pkg.started_at,
			pkg.updated_at,
			pb.batch_id,
			pb.batch_number,
			pb.product_type,
			pb.status,
			pb.scheduled_date,
			pb.total_sap_output,
			pkg.notes,
			pkg.bottle_cost,
			pkg.lid_cost,
			pkg.alufoil_cost,
			pkg.vacuum_bag_cost,
			pkg.parchment_paper_cost,
			pkg.finished_quantity
		ORDER BY pkg.started_at DESC, pkg.packaging_id ASC
	`;

	const { rows } = await pool.query(query);
	return rows;
}

router.get("/batches", auth, requireRole("Packaging", "Processing", "Administrator"), async (_req, res) => {
	try {
		const summaries = await Promise.all(
			SUPPORTED_PRODUCTS.map((product) => fetchPackagingSummaries(product))
		);
		const batches = summaries.flat().map(mapPackagingRow);
		res.json({ batches });
	} catch (error) {
		console.error("Error fetching packaging batches:", error);
		res.status(500).json({ error: "Failed to fetch packaging batches" });
	}
});

	router.patch(
		"/batches/:packagingId",
		auth,
		requireRole("Packaging", "Administrator"),
		async (req, res) => {
			try {
				const { packagingId } = req.params;
				const validated = updatePackagingSchema.parse(req.body ?? {});

				const existing = await fetchPackagingBatchByPackagingId(packagingId);
				if (!existing) {
					return res.status(404).json({ error: "Packaging batch not found" });
				}

				const productType = (existing.productType || "").toLowerCase();

				if (productType === "sap") {
					if (validated.bottleCost === undefined || validated.lidCost === undefined) {
						return res
							.status(400)
							.json({ error: "Bottle cost and lid cost are required for sap packaging." });
					}
				} else if (productType === "treacle") {
					if (
						validated.alufoilCost === undefined ||
						validated.vacuumBagCost === undefined ||
						validated.parchmentPaperCost === undefined
					) {
						return res.status(400).json({
							error: "Alufoil, vacuum bag, and parchment paper costs are required for treacle packaging.",
						});
					}
				}

				const finishedQuantityValue = validated.finishedQuantity;
				if (finishedQuantityValue === undefined) {
					return res.status(400).json({ error: "Finished quantity is required for packaging." });
				}

				const updateClauses: string[] = [];
				const params: any[] = [];
				let paramIndex = 1;

				const applyCostUpdate = (
					field: keyof typeof validated,
					dbColumn: string
				) => {
					const value = validated[field];
					if (value !== undefined) {
						updateClauses.push(`${dbColumn} = $${paramIndex}`);
						params.push(value);
						paramIndex++;
					}
				};

				applyCostUpdate("finishedQuantity", "finished_quantity");
				applyCostUpdate("bottleCost", "bottle_cost");
				applyCostUpdate("lidCost", "lid_cost");
				applyCostUpdate("alufoilCost", "alufoil_cost");
				applyCostUpdate("vacuumBagCost", "vacuum_bag_cost");
				applyCostUpdate("parchmentPaperCost", "parchment_paper_cost");

				if (validated.status) {
					updateClauses.push(`status = $${paramIndex}`);
					params.push(validated.status);
					paramIndex++;
				}

				if (validated.notes !== undefined) {
					updateClauses.push(`notes = $${paramIndex}`);
					params.push(validated.notes);
					paramIndex++;
				}

				if (updateClauses.length === 0) {
					return res.status(400).json({ error: "No fields provided to update." });
				}

				updateClauses.push(`updated_at = NOW()`);

				const context = await resolvePackagingContext(packagingId);
				if (!context) {
					return res.status(404).json({ error: "Packaging batch not found" });
				}

				const updateQuery = `
					UPDATE ${context.packagingTable}
					SET ${updateClauses.join(", ")}
					WHERE packaging_id = $${paramIndex}
				`;

				params.push(packagingId);

				await pool.query(updateQuery, params);

				const refreshed = await fetchPackagingBatchByPackagingId(packagingId);
				if (!refreshed) {
					return res.status(500).json({ error: "Failed to load updated packaging batch" });
				}

				res.json(refreshed);
			} catch (error: any) {
				if (error instanceof z.ZodError) {
					return res.status(400).json({ error: "Validation error", details: error.issues });
				}
				console.error("Error updating packaging batch:", error);
				res.status(500).json({ error: "Failed to update packaging batch" });
			}
		}
	);

export default router;
