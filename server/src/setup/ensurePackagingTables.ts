import type { PoolClient } from "pg";
import { pool } from "../db.js";

let packagingReady: Promise<void> | null = null;

async function runDDL(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.packaging_batches (
      id BIGSERIAL PRIMARY KEY,
      packaging_id TEXT UNIQUE NOT NULL,
      processing_batch_id BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_packaging_processing_batch
        FOREIGN KEY (processing_batch_id)
        REFERENCES processing_batches(id)
        ON DELETE CASCADE,
      CONSTRAINT packaging_status_check
        CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
    );
  `);

  await client.query(`
    ALTER TABLE public.packaging_batches
      ADD COLUMN IF NOT EXISTS bottle_cost NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS lid_cost NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS alufoil_cost NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS vacuum_bag_cost NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS parchment_paper_cost NUMERIC(12,2),
      ADD COLUMN IF NOT EXISTS finished_quantity NUMERIC(12,2);
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_batches_processing_batch
      ON public.packaging_batches (processing_batch_id);
  `);
}

export async function ensurePackagingTables(client?: PoolClient) {
  if (!packagingReady) {
    packagingReady = (async () => {
      const needsRelease = !client;
      const runner = client ?? (await pool.connect());
      try {
        await runDDL(runner);
      } finally {
        if (needsRelease) {
          runner.release();
        }
      }
    })().catch((error) => {
      packagingReady = null;
      throw error;
    });
  }

  await packagingReady;
}
