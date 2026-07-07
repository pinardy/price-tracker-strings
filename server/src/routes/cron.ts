import { Router } from 'express';
import { ah } from '../lib/asyncHandler.js';
import { runFetch } from '../services/fetcher.js';

export const cronRouter = Router();

// Vercel Cron invokes this with `Authorization: Bearer $CRON_SECRET`.
// Runs to completion within the request (fits the 300s function limit).
cronRouter.get('/fetch', ah(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const runId = await runFetch('cron');
  res.json({ ok: true, runId, skipped: runId == null });
}));
