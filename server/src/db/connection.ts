import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

// This branch uses its own DB file so the git-tracked app.db on main is
// never touched or migrated past main's schema version.
export const db = new Database(process.env.DB_PATH ?? path.join(dataDir, 'app-crud.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
