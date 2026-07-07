import { db } from '../db/connection.js';
import { createPoliteFetch } from '../lib/politeFetch.js';
import { getProvider, getProviders } from '../providers/registry.js';
import type { FetchContext, LinkRef } from '../providers/types.js';
import { evaluateAlerts } from './alerts.js';

export type FetchTrigger = 'startup' | 'cron' | 'manual';

interface LinkRow extends LinkRef {
  id: number;
  providerId: string;
}

let running = false;

export function isFetchRunning(): boolean {
  return running;
}

export function getLastRun(): unknown {
  return db
    .prepare('SELECT * FROM fetch_runs ORDER BY id DESC LIMIT 1')
    .get();
}

/**
 * Fetches current prices for every active link of every active product.
 * Providers run in parallel; politeFetch keeps each host serial and spaced.
 * Individual link failures are logged, never abort the run.
 */
export async function runFetch(trigger: FetchTrigger, onlyLinkIds?: number[]): Promise<number | null> {
  if (running) return null;
  running = true;

  const runId = db
    .prepare('INSERT INTO fetch_runs (trigger) VALUES (?)')
    .run(trigger).lastInsertRowid as number;

  try {
    let sql = `
      SELECT l.id, l.provider_id AS providerId, l.external_id AS externalId,
             l.variant_id AS variantId, l.query, l.url
      FROM product_links l
      JOIN products p ON p.id = l.product_id
      WHERE l.is_active = 1 AND p.is_active = 1`;
    const params: unknown[] = [];
    if (onlyLinkIds?.length) {
      sql += ` AND l.id IN (${onlyLinkIds.map(() => '?').join(',')})`;
      params.push(...onlyLinkIds);
    }
    const links = db.prepare(sql).all(...params) as LinkRow[];

    const ctx: FetchContext = { fetch: createPoliteFetch(), cache: new Map() };
    const insertSnapshot = db.prepare(
      'INSERT INTO price_snapshots (link_id, run_id, price, currency, in_stock) VALUES (?, ?, ?, ?, ?)',
    );

    const byProvider = new Map<string, LinkRow[]>();
    for (const link of links) {
      (byProvider.get(link.providerId) ?? byProvider.set(link.providerId, []).get(link.providerId)!).push(link);
    }

    let okCount = 0;
    const errors: { linkId: number; message: string }[] = [];

    await Promise.all(
      [...byProvider.entries()].map(async ([providerId, providerLinks]) => {
        const provider = getProvider(providerId);
        for (const link of providerLinks) {
          if (!provider) {
            errors.push({ linkId: link.id, message: `provider ${providerId} unavailable` });
            continue;
          }
          try {
            const result = await provider.fetchPrice(link, ctx);
            insertSnapshot.run(link.id, runId, result.price, result.currency, result.inStock == null ? null : Number(result.inStock));
            okCount++;
          } catch (err) {
            errors.push({ linkId: link.id, message: err instanceof Error ? err.message : String(err) });
          }
        }
      }),
    );

    db.prepare(
      `UPDATE fetch_runs SET finished_at = datetime('now'), ok_count = ?, error_count = ?, error_log = ? WHERE id = ?`,
    ).run(okCount, errors.length, errors.length ? JSON.stringify(errors) : null, runId);

    evaluateAlerts(runId);
    console.log(`[fetch] run ${runId} (${trigger}): ${okCount} ok, ${errors.length} errors`);
    return runId;
  } finally {
    running = false;
  }
}

export function getEnabledProviders() {
  return getProviders().map((p) => ({ id: p.id, label: p.label, kind: p.kind }));
}
