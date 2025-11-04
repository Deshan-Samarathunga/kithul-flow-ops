import "dotenv/config";
import { pool } from "../src/db.js";
import bcrypt from "bcrypt";

const TEST_USERS = [
  {
    userId: "admin01",
    password: "12345678",
    name: "Administrator User",
    role: "Administrator"
  },
  {
    userId: "field01",
    password: "12345678",
    name: "Field Collection User",
    role: "Field Collection"
  },
  {
    userId: "process01",
    password: "12345678",
    name: "Processing User",
    role: "Processing"
  },
  {
    userId: "package01",
    password: "12345678",
    name: "Packaging User",
    role: "Packaging"
  },
  {
    userId: "label01",
    password: "12345678",
    name: "Labeling User",
    role: "Labeling"
  }
];

async function seedTestUsers() {
  console.log("🌱 Seeding test users...");

  for (const user of TEST_USERS) {
    try {
      // Check if user already exists
      const existing = await pool.query("SELECT user_id FROM users WHERE user_id = $1", [
        user.userId
      ]);

      if (existing.rows.length > 0) {
        console.log(`⚠️  User '${user.userId}' already exists, skipping...`);
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Insert the user
      await pool.query(
        `INSERT INTO public.users (user_id, password_hash, name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      , [user.userId, hashedPassword, user.name, user.role]
      );

      console.log(`✅ Created user: ${user.userId} (${user.role})`);
    } catch (error) {
      console.error(`❌ Error creating user ${user.userId}:`, error);
    }
  }

  console.log("\n✨ Test users seeding complete!");
  console.log("\n📋 Test Users Created:");
  console.log("================================");
  TEST_USERS.forEach(user => {
    console.log(`${user.role.padEnd(20)} | Username: ${user.userId} | Password: ${user.password}`);
  });
  console.log("================================");
}

// Run the seeding
seedTestUsers()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
