import { Router } from 'express';
import { db } from '../db/connection.js';
import { createPoliteFetch } from '../lib/politeFetch.js';
import { getProviders } from '../providers/registry.js';
import type { FetchContext } from '../providers/types.js';
import { getEnabledProviders, getLastRun, isFetchRunning, runFetch } from '../services/fetcher.js';
import { listAlerts } from '../services/queries.js';

export const miscRouter = Router();

miscRouter.get('/providers', (_req, res) => {
  res.json(getEnabledProviders());
});

miscRouter.get('/search', async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) return res.status(400).json({ error: 'q is required' });
  const providerFilter = req.query.providers
    ? String(req.query.providers).split(',')
    : null;

  const providers = getProviders().filter((p) => !providerFilter || providerFilter.includes(p.id));
  const ctx: FetchContext = { fetch: createPoliteFetch(), cache: new Map() };

  const settled = await Promise.allSettled(providers.map((p) => p.search(query, ctx)));
  res.json(
    providers.map((p, i) => {
      const outcome = settled[i];
      return outcome.status === 'fulfilled'
        ? { providerId: p.id, label: p.label, kind: p.kind, results: outcome.value }
        : { providerId: p.id, label: p.label, kind: p.kind, error: String(outcome.reason?.message ?? outcome.reason) };
    }),
  );
});

miscRouter.post('/fetch', (_req, res) => {
  if (isFetchRunning()) return res.status(202).json({ status: 'already-running' });
  void runFetch('manual');
  res.status(202).json({ status: 'started' });
});

miscRouter.get('/fetch/status', (_req, res) => {
  res.json({ running: isFetchRunning(), lastRun: getLastRun() });
});

miscRouter.delete('/links/:id', (req, res) => {
  const result = db.prepare('UPDATE product_links SET is_active = 0 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

miscRouter.get('/alerts', (req, res) => {
  res.json(listAlerts(req.query.unacknowledged === '1'));
});

miscRouter.post('/alerts/:id/ack', (req, res) => {
  const result = db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

miscRouter.post('/alerts/ack-all', (_req, res) => {
  db.prepare('UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0').run();
  res.status(204).end();
});
