import 'dotenv/config';
import { createClient, type InArgs, type InStatement } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

// DATABASE_URL unset → local file DB (no Turso account needed for dev);
// libsql://... + TURSO_AUTH_TOKEN → hosted Turso (Vercel deployment).
export const db = createClient({
  url: process.env.DATABASE_URL || `file:${path.join(dataDir, 'app-crud.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  intMode: 'number',
});

export async function allRows<T = any>(sql: string, args: InArgs = []): Promise<T[]> {
  return (await db.execute({ sql, args })).rows as unknown as T[];
}

export async function firstRow<T = any>(sql: string, args: InArgs = []): Promise<T | undefined> {
  return (await allRows<T>(sql, args))[0];
}

export async function run(
  sql: string,
  args: InArgs = [],
): Promise<{ changes: number; lastId: number }> {
  const result = await db.execute({ sql, args });
  return { changes: result.rowsAffected, lastId: Number(result.lastInsertRowid ?? 0) };
}

/** Atomic multi-statement write in one round trip. */
export function batch(statements: InStatement[]) {
  return db.batch(statements, 'write');
}
