import { pool } from "./db.js";

type RoleAuditEvent = {
  event: string;
  actorId?: number | null;
  actorEmail?: string | null;
  actorUserId?: string | null;
  targetId?: number | null;
  targetEmail?: string | null;
  targetUserId?: string | null;
  previousRole?: string | null;
  newRole?: string | null;
  metadata?: Record<string, unknown> | null;
};

let tableReady: Promise<void> | null = null;

async function ensureAuditTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.role_change_audit (
      id bigserial PRIMARY KEY,
      event TEXT NOT NULL,
      actor_id INTEGER,
      actor_email TEXT,
      actor_user_id TEXT,
      target_id INTEGER,
      target_email TEXT,
      target_user_id TEXT,
      previous_role TEXT,
      new_role TEXT,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE public.role_change_audit
      ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
  `);

  await pool.query(`
    ALTER TABLE public.role_change_audit
      ADD COLUMN IF NOT EXISTS target_user_id TEXT;
  `);
}

export async function recordRoleAudit(entry: RoleAuditEvent) {
  if (!tableReady) {
    tableReady = ensureAuditTable();
  }
  await tableReady;

  const {
    event,
    actorId = null,
    actorEmail = null,
    actorUserId = null,
    targetId = null,
    targetEmail = null,
    targetUserId = null,
    previousRole = null,
    newRole = null,
    metadata = null,
  } = entry;

  await pool.query(
    `
      INSERT INTO public.role_change_audit (
        event,
        actor_id,
        actor_email,
        actor_user_id,
        target_id,
        target_email,
        target_user_id,
        previous_role,
        new_role,
        details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      event,
      actorId,
      actorEmail,
      actorUserId,
      targetId,
      targetEmail,
      targetUserId,
      previousRole,
      newRole,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}
