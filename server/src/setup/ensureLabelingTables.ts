import type { PoolClient } from "pg";
import { pool } from "../db.js";

let labelingReady: Promise<void> | null = null;

async function runDDL(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.labeling_batches (
      id BIGSERIAL PRIMARY KEY,
      labeling_id TEXT UNIQUE NOT NULL,
      packaging_batch_id BIGINT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      sticker_cost NUMERIC(12,2),
      shrink_sleeve_cost NUMERIC(12,2),
      neck_tag_cost NUMERIC(12,2),
      corrugated_carton_cost NUMERIC(12,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_labeling_packaging
        FOREIGN KEY (packaging_batch_id)
        REFERENCES public.packaging_batches(id)
        ON DELETE CASCADE,
      CONSTRAINT labeling_status_check
        CHECK (status IN ('pending', 'in-progress', 'completed', 'on-hold'))
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_labeling_batches_packaging_id
      ON public.labeling_batches (packaging_batch_id);
  `);
}

export async function ensureLabelingTables(client?: PoolClient) {
  if (!labelingReady) {
    labelingReady = (async () => {
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
      labelingReady = null;
      throw error;
    });
  }

  await labelingReady;
}
