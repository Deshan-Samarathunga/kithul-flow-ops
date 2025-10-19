import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, "../../db/010_create_packaging_tables.sql");
const sql = await fs.readFile(sqlPath, "utf8");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:admin@127.0.0.1:5432/kithul_flow_db",
});

try {
  console.log("Applying packaging tables migration...");
  await pool.query(sql);
  console.log("Packaging tables migration applied.");
} catch (error) {
  console.error("Failed to apply packaging migration:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
