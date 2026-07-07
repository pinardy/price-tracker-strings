import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { migrate } from './db/migrate.js';
import { passwordGate } from './middleware/auth.js';
import { productsRouter } from './routes/products.js';
import { alertRulesRouter } from './routes/alertRules.js';
import { cronRouter } from './routes/cron.js';
import { miscRouter } from './routes/misc.js';
import { startScheduler } from './services/scheduler.js';

export const app = express();
app.use(express.json());

// Health and cron are registered BEFORE the password gate: health stays
// public, cron authenticates with CRON_SECRET instead.
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/cron', cronRouter);
app.use('/api', passwordGate);
app.use('/api/products', productsRouter);
app.use('/api/alert-rules', alertRulesRouter);
app.use('/api', miscRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal error' });
});

// On Vercel the app is exported and served by api/index.ts; migrations run
// via `npm run migrate` and scheduling via vercel.json crons.
if (!process.env.VERCEL) {
  await migrate();
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => {
    const { cronExpr } = startScheduler();
    console.log(`[server] listening on http://localhost:${port} (fetch cron: ${cronExpr})`);
  });
}
