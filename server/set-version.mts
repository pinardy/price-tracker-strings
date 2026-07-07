import { createClient } from '@libsql/client';
const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
await db.execute('PRAGMA user_version = 3');
const v = await db.execute('PRAGMA user_version');
console.log('user_version now:', JSON.stringify(v.rows[0]));
db.close();
