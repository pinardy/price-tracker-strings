import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, firstRow } from './connection.js';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

// Sequential migrations; index i produces user_version i + 1.
// schema.sql stays frozen at the v1 shape — fresh DBs replay every step.
const MIGRATIONS: (() => string)[] = [
  // v1: initial schema
  () => fs.readFileSync(schemaPath, 'utf-8'),
  // v2: SGD normalization — converted price per snapshot + FX rate store.
  // Non-SGD price_sgd backfill happens in runFetch's sweep (needs the network).
  () => `
    ALTER TABLE price_snapshots ADD COLUMN price_sgd REAL;
    CREATE TABLE fx_rates (
      currency    TEXT PRIMARY KEY,
      rate_to_sgd REAL NOT NULL,
      fetched_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    UPDATE price_snapshots SET price_sgd = price WHERE currency = 'SGD';
    UPDATE products SET target_currency = 'SGD';
  `,
  // v3 (this branch): alert rules as first-class CRUD records.
  () => `
    CREATE TABLE alert_rules (
      id            INTEGER PRIMARY KEY,
      product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      threshold_sgd REAL NOT NULL CHECK (threshold_sgd > 0),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    ALTER TABLE alerts ADD COLUMN rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL;
    INSERT INTO alert_rules (product_id, threshold_sgd)
      SELECT id, target_price FROM products WHERE target_price IS NOT NULL;
    UPDATE products SET target_price = NULL;
  `,
];

/** Splits a migration script into statements (no semicolons inside bodies here). */
function splitStatements(script: string): string[] {
  return script
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function migrate(): Promise<void> {
  const row = await firstRow<{ user_version: number }>('PRAGMA user_version');
  const current = Number(row?.user_version ?? 0);
  for (let version = current; version < MIGRATIONS.length; version++) {
    const statements = splitStatements(MIGRATIONS[version]());
    try {
      await db.batch([...statements, `PRAGMA user_version = ${version + 1}`], 'write');
    } catch {
      // Some servers reject PRAGMA inside a batch — run it as a follow-up.
      // (Only reachable for hand-run migrations; small non-atomic window is fine.)
      await db.batch(statements, 'write');
      await db.execute(`PRAGMA user_version = ${version + 1}`);
    }
    console.log(`[db] migrated schema to version ${version + 1}`);
  }
}
