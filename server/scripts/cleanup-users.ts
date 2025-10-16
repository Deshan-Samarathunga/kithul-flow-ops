import "dotenv/config";
import { pool } from "../src/db.js";

async function cleanupUsers() {
  try {
    console.log("Starting users table cleanup...");

    // First, check if there are any drafts referencing these users
    console.log("Checking for foreign key references...");
    const { rows: draftRefs } = await pool.query(
      "SELECT DISTINCT created_by FROM public.drafts WHERE created_by IN (1, 2, 3, 4, 5, 6)"
    );
    
    if (draftRefs.length > 0) {
      console.log("Found drafts referencing these users. Updating drafts to use admin01...");
      
      // Get the admin01 user id
      const { rows: adminUser } = await pool.query(
        "SELECT id FROM public.users WHERE user_id = 'admin01'"
      );
      
      if (adminUser.length > 0) {
        const adminId = adminUser[0].id;
        
        // Update drafts to reference admin01 instead
        const updateResult = await pool.query(
          "UPDATE public.drafts SET created_by = $1 WHERE created_by IN (1, 2, 3, 4, 5, 6)",
          [adminId]
        );
        console.log(`Updated ${updateResult.rowCount} drafts to reference admin01`);
      }
    }

    // Now delete the first 6 rows (ids 1-6)
    console.log("Deleting rows with ids 1-6...");
    const deleteResult = await pool.query(
      "DELETE FROM public.users WHERE id IN (1, 2, 3, 4, 5, 6)"
    );
    console.log(`Deleted ${deleteResult.rowCount} rows`);

    // Drop the email column
    console.log("Dropping email column...");
    await pool.query("ALTER TABLE public.users DROP COLUMN IF EXISTS email");
    console.log("Email column dropped successfully");

    // Verify the cleanup
    console.log("\nRemaining users:");
    const { rows } = await pool.query(
      "SELECT id, user_id, name, role, created_at FROM public.users ORDER BY id"
    );
    
    console.table(rows);

    console.log("\n✅ Users table cleanup completed successfully!");
    
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    await pool.end();
  }
}

cleanupUsers();
