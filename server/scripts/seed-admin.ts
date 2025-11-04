import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../src/db.js";

const DEFAULT_PASSWORD = "12345678";

const users = [
  {
    userId: "admin01",
    password: DEFAULT_PASSWORD,
    name: "Admin User",
    role: "Administrator",
  },
  {
    userId: "field01",
    password: DEFAULT_PASSWORD,
    name: "Field Collector",
    role: "Field Collection",
  },
  {
    userId: "process01",
    password: DEFAULT_PASSWORD,
    name: "Processing Manager",
    role: "Processing",
  },
  {
    userId: "package01",
    password: DEFAULT_PASSWORD,
    name: "Packaging Specialist",
    role: "Packaging",
  },
  {
    userId: "label01",
    password: DEFAULT_PASSWORD,
    name: "Labeling Expert",
    role: "Labeling",
  },
];

async function main() {
  console.log("Creating users for all roles...");

  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 12);

    const { rows } = await pool.query(
      `INSERT INTO public.users (user_id, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             name = EXCLUDED.name,
             role = EXCLUDED.role
       RETURNING id, user_id, role`,
      [user.userId, hash, user.name, user.role],
    );

    console.log(`${user.role} ready:`, rows[0]);
  }

  console.log("\nAll users created successfully!");
  console.log("\nLogin credentials:");
  users.forEach((user) => {
    console.log(`${user.role}: ${user.userId} / ${user.password}`);
  });

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
