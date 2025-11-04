import "dotenv/config";
import { pool } from "../src/db.js";

const centers = [
  {
    centerId: "center001",
    centerName: "Galle Collection Center",
    location: "Galle",
    centerAgent: "John Silva",
    contactPhone: "+94 71 000 0001",
  },
  {
    centerId: "center002",
    centerName: "Kurunegala Collection Center",
    location: "Kurunegala",
    centerAgent: "Mary Perera",
    contactPhone: "+94 77 000 0002",
  },
  {
    centerId: "center003",
    centerName: "Hikkaduwa Collection Center",
    location: "Hikkaduwa",
    centerAgent: "David Fernando",
    contactPhone: "+94 77 000 0003",
  },
  {
    centerId: "center004",
    centerName: "Matara Collection Center",
    location: "Matara",
    centerAgent: "Sarah Jayawardena",
    contactPhone: "+94 71 000 0004",
  },
];

async function main() {
  console.log("Creating collection centers...");

  for (const center of centers) {
    const { rows } = await pool.query(
      `INSERT INTO public.collection_centers (center_id, center_name, location, center_agent, contact_phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (center_id) DO UPDATE
         SET center_name = EXCLUDED.center_name,
             location = EXCLUDED.location,
             center_agent = EXCLUDED.center_agent,
             contact_phone = EXCLUDED.contact_phone,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
       RETURNING id, center_id, center_name, location`,
      [
        center.centerId,
        center.centerName,
        center.location,
        center.centerAgent,
        center.contactPhone,
      ],
    );

    console.log(`✓ ${center.centerName} (${center.centerId}):`, rows[0]);
  }

  console.log("\nAll collection centers created successfully!");
  console.log(`\nTotal centers: ${centers.length}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("Error seeding collection centers:", e);
  process.exit(1);
});
