import { db } from '../db/connection.js';
import { migrate } from '../db/migrate.js';
import { runFetch } from '../services/fetcher.js';

// One fetch run for CLI/CI use. Works against any DATABASE_URL (local file
// or Turso).
await migrate();
const runId = await runFetch('cron');
if (runId == null) {
  console.error('[fetch-once] a fetch was already running');
  process.exit(1);
}
db.close();
console.log('[fetch-once] done');
