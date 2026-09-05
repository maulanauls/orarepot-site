import { Pool, QueryResultRow } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function q<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function insertOutbox(
  topic: string,
  aggregateType: string,
  aggregateId: string,
  payload: unknown,
) {
  await q(
    `INSERT INTO cm_outbox (topic, aggregate_type, aggregate_id, payload)
     VALUES ($1,$2,$3,$4::jsonb)`,
    [topic, aggregateType, aggregateId, JSON.stringify(payload)],
  );
}

export function requireUser(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers['x-user-id'];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    const err = new Error('missing user');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return id;
}

export function requireInternal(headers: Record<string, string | string[] | undefined>) {
  const raw = headers['x-internal-key'];
  const got = Array.isArray(raw) ? raw[0] : raw;
  if (got !== process.env.INTERNAL_KEY) {
    const err = new Error('internal key');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
}

export function httpError(status: number, message: string): Error {
  const err = new Error(message);
  (err as Error & { status: number }).status = status;
  return err;
}
