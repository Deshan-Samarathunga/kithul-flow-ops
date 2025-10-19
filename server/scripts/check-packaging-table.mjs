import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:admin@127.0.0.1:5432/kithul_flow_db",
});

try {
  const { rows } = await pool.query("SELECT to_regclass('public.packaging_batches') AS exists");
  console.log(rows[0]);
} finally {
  await pool.end();
}
