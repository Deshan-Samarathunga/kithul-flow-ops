import express from "express";
import { pool } from "../db.js";
import { auth, requireRole } from "../middleware/authMiddleware.js";

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
		bucketCount: Number(row.bucket_count ?? 0),
		totalQuantity: Number(row.total_quantity ?? 0),
	};
}

router.get("/batches", auth, requireRole("Packaging", "Processing", "Administrator"), async (_req, res) => {
	try {
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
				COALESCE(SUM(b.quantity), 0) AS total_quantity,
				COUNT(pbb.bucket_id) AS bucket_count
			FROM packaging_batches pkg
			JOIN processing_batches pb ON pb.id = pkg.processing_batch_id
			LEFT JOIN processing_batch_buckets pbb ON pbb.processing_batch_id = pb.id
			LEFT JOIN buckets b ON b.id = pbb.bucket_id
			GROUP BY
				pkg.packaging_id,
				pkg.status,
				pkg.started_at,
				pkg.updated_at,
				pb.batch_id,
				pb.batch_number,
				pb.product_type,
				pb.status,
				pb.scheduled_date
			ORDER BY pkg.started_at DESC, pkg.packaging_id ASC
		`;

		const { rows } = await pool.query(query);
		const batches = rows.map(mapPackagingRow);
		res.json({ batches });
	} catch (error) {
		console.error("Error fetching packaging batches:", error);
		res.status(500).json({ error: "Failed to fetch packaging batches" });
	}
});

export default router;
