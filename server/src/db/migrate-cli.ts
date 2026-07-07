import { db } from './connection.js';
import { migrate } from './migrate.js';

// Run schema migrations against DATABASE_URL (or the local file DB).
// Used for Turso: DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run migrate
await migrate();
db.close();
console.log('[migrate] done');
