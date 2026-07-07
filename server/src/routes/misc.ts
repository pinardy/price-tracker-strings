import { Router } from 'express';
import { run } from '../db/connection.js';
import { ah } from '../lib/asyncHandler.js';
import { background } from '../lib/background.js';
import { createPoliteFetch } from '../lib/politeFetch.js';
import { getProviders } from '../providers/registry.js';
import type { FetchContext } from '../providers/types.js';
import { getEnabledProviders, getLastRun, isFetchRunning, runFetch } from '../services/fetcher.js';
import { listAlerts } from '../services/queries.js';

export const miscRouter = Router();

miscRouter.get('/providers', (_req, res) => {
  res.json(getEnabledProviders());
});

miscRouter.get('/search', ah(async (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
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
}));

miscRouter.post('/fetch', ah(async (_req, res) => {
  if (await isFetchRunning()) {
    res.status(202).json({ status: 'already-running' });
    return;
  }
  background(runFetch('manual'));
  res.status(202).json({ status: 'started' });
}));

miscRouter.get('/fetch/status', ah(async (_req, res) => {
  const [running, lastRun] = await Promise.all([isFetchRunning(), getLastRun()]);
  res.json({ running, lastRun });
}));

miscRouter.delete('/links/:id', ah(async (req, res) => {
  const { changes } = await run('UPDATE product_links SET is_active = 0 WHERE id = ?', [req.params.id]);
  if (!changes) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(204).end();
}));

miscRouter.get('/alerts', ah(async (req, res) => {
  res.json(await listAlerts(req.query.unacknowledged === '1'));
}));

miscRouter.post('/alerts/:id/ack', ah(async (req, res) => {
  const { changes } = await run('UPDATE alerts SET acknowledged = 1 WHERE id = ?', [req.params.id]);
  if (!changes) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(204).end();
}));

miscRouter.post('/alerts/ack-all', ah(async (_req, res) => {
  await run('UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0');
  res.status(204).end();
}));
