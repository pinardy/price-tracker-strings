import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allRows, db, firstRow, run } from './connection.js';

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

/**
 * Version tracking lives in a schema_version table because Turso rejects
 * PRAGMA user_version writes. Pre-existing databases are bootstrapped from
 * the pragma (local files) or from which tables exist (imported DBs).
 */
async function currentVersion(): Promise<number> {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = await firstRow<{ version: number }>('SELECT version FROM schema_version');
  if (row) return Number(row.version);
  const detected = await detectLegacyVersion();
  await run('INSERT INTO schema_version (version) VALUES (?)', [detected]);
  return detected;
}

async function detectLegacyVersion(): Promise<number> {
  try {
    const row = await firstRow<{ user_version: number }>('PRAGMA user_version');
    if (Number(row?.user_version) > 0) return Number(row!.user_version);
  } catch {
    // pragma unsupported — fall through to table detection
  }
  const tables = await allRows<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const names = new Set(tables.map((t) => t.name));
  if (names.has('alert_rules')) return 3;
  if (names.has('fx_rates')) return 2;
  if (names.has('products')) return 1;
  return 0;
}

export async function migrate(): Promise<void> {
  const current = await currentVersion();
  for (let version = current; version < MIGRATIONS.length; version++) {
    const statements = splitStatements(MIGRATIONS[version]());
    await db.batch(
      [...statements, { sql: 'UPDATE schema_version SET version = ?', args: [version + 1] }],
      'write',
    );
    console.log(`[db] migrated schema to version ${version + 1}`);
  }
}
