import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

const SCHEMA_VERSION = 1;

export function migrate(): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current >= SCHEMA_VERSION) return;
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf-8'));
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
  console.log(`[db] migrated schema to version ${SCHEMA_VERSION}`);
}
