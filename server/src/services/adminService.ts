import { pool } from "../db.js";

export async function listUsers() {
  const { rows } = await pool.query(
    `SELECT id, user_id, name, role, profile_image, created_at
       FROM public.users
      WHERE role <> 'Administrator'
      ORDER BY created_at DESC`,
  );
  return rows;
}

export async function getUserById(id: number) {
  const { rows } = await pool.query(
    `SELECT id, user_id, name, role, profile_image, created_at
       FROM public.users
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertUser(
  userId: string,
  passwordHash: string,
  name: string | null,
  role: string,
) {
  const { rows } = await pool.query(
    `INSERT INTO public.users (
       user_id,
       password_hash,
       name,
       role
     )
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, role, created_at, profile_image`,
    [userId, passwordHash, name, role],
  );
  return rows[0];
}

export async function updateUserDynamic(id: number, setClause: string, params: any[]) {
  const { rows } = await pool.query(
    `UPDATE public.users
        SET ${setClause}
      WHERE id = $${params.length}
      RETURNING id, user_id, name, role, created_at, profile_image`,
    params,
  );
  return rows[0] ?? null;
}

export async function deleteUserById(id: number) {
  await pool.query(`DELETE FROM public.users WHERE id = $1`, [id]);
}

// Centers
export async function listCenters() {
  const { rows } = await pool.query(
    `SELECT id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at
     FROM collection_centers
     ORDER BY center_name`,
  );
  return rows;
}

export async function getCenterById(id: number) {
  const { rows } = await pool.query(
    `SELECT id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at
     FROM collection_centers
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertCenter(
  centerId: string,
  centerName: string,
  location: string,
  centerAgent: string,
  contactPhone: string | null,
) {
  const { rows } = await pool.query(
    `INSERT INTO collection_centers (
       center_id,
       center_name,
       location,
       center_agent,
       contact_phone
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at`,
    [centerId, centerName, location, centerAgent, contactPhone],
  );
  return rows[0];
}

export async function updateCenterDynamic(id: number, setClause: string, params: any[]) {
  const { rows } = await pool.query(
    `UPDATE collection_centers
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${params.length}
     RETURNING id, center_id, center_name, location, center_agent, contact_phone, is_active, created_at, updated_at`,
    params,
  );
  return rows[0] ?? null;
}

export async function centerHasCans(centerId: number) {
  const { rows } = await pool.query(
    `SELECT 1 FROM (
      SELECT collection_center_id FROM sap_cans
      UNION ALL
      SELECT collection_center_id FROM treacle_cans
    ) cans WHERE collection_center_id = $1 LIMIT 1`,
    [centerId],
  );
  return rows.length > 0;
}

export async function deleteCenterById(id: number) {
  await pool.query(`DELETE FROM collection_centers WHERE id = $1`, [id]);
}
