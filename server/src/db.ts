import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: false,
});

async function columnExists(client: pg.PoolClient, table: string, column: string) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const table of ["treacle_processing_batches", "jaggery_processing_batches"]) {
      const fqtn = `public.${table}`;
      await client.query(`ALTER TABLE ${fqtn} ADD COLUMN IF NOT EXISTS used_gas_kg NUMERIC(12,2)`);

      if (await columnExists(client, table, "gas_cost")) {
        await client.query(`
          UPDATE ${fqtn}
          SET used_gas_kg = CASE WHEN used_gas_kg IS NULL THEN gas_cost ELSE used_gas_kg END
        `);
        await client.query(`ALTER TABLE ${fqtn} DROP COLUMN IF EXISTS gas_cost`);
      }

      await client.query(`ALTER TABLE ${fqtn} DROP COLUMN IF EXISTS labor_cost`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database initialization failed", error);
    throw error;
  } finally {
    client.release();
  }
}

