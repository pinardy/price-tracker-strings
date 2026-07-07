import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

// Sequential migrations; index i produces user_version i + 1.
// schema.sql stays frozen at the v1 shape — fresh DBs replay every step.
const MIGRATIONS: (() => void)[] = [
  // v1: initial schema
  () => db.exec(fs.readFileSync(schemaPath, 'utf-8')),
  // v2: SGD normalization — converted price per snapshot + FX rate store.
  // Non-SGD price_sgd backfill happens in runFetch's sweep (needs the network).
  () =>
    db.exec(`
      ALTER TABLE price_snapshots ADD COLUMN price_sgd REAL;
      CREATE TABLE fx_rates (
        currency    TEXT PRIMARY KEY,
        rate_to_sgd REAL NOT NULL,
        fetched_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      UPDATE price_snapshots SET price_sgd = price WHERE currency = 'SGD';
      UPDATE products SET target_currency = 'SGD';
    `),
];

export function migrate(): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      MIGRATIONS[version]();
      db.pragma(`user_version = ${version + 1}`);
    })();
    console.log(`[db] migrated schema to version ${version + 1}`);
  }
}
