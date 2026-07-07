import { db } from '../db/connection.js';

/** Minimum distinct daily lows needed before a statistical band is trustworthy. */
const MIN_POINTS = 8;
/** Window of history the "usual range" is computed over. */
const WINDOW_DAYS = 90;
/** Tukey fence multiplier: lower bound = Q1 - IQR_MULT * IQR. */
const IQR_MULT = 1.5;

// Prepared lazily inside the functions below (not at module scope): this file
// is imported transitively before migrate() runs on a fresh DB, so the alerts
// table may not exist yet at import time.
const openAlertSql = 'SELECT 1 FROM alerts WHERE product_id = ? AND kind = ? AND acknowledged = 0 LIMIT 1';

/**
 * After a fetch run, raise price alerts for that run's snapshots.
 * Two independent kinds, deduped separately so one never masks the other:
 *  - 'target'      : lowest SGD price is at/below the user's manual target.
 *  - 'below_range' : lowest SGD price fell below the product's own usual
 *                    low-price range (a statistical dip, no target needed).
 * A product with an unacknowledged alert of a given kind doesn't get duplicates.
 */
export function evaluateAlerts(runId: number): void {
  const targeted = evaluateTargetAlerts(runId);
  // A product that just hit its target is already covered; don't also raise a
  // (redundant) below-range alert for it in the same run.
  evaluateBelowRangeAlerts(runId, targeted);
}

function evaluateTargetAlerts(runId: number): Set<number> {
  const hits = db
    .prepare(
      `SELECT p.id AS product_id, p.target_price, s.id AS snapshot_id, s.link_id, s.price_sgd
       FROM products p
       JOIN product_links l ON l.product_id = p.id AND l.is_active = 1
       JOIN price_snapshots s ON s.link_id = l.id AND s.run_id = ?
       WHERE p.is_active = 1
         AND p.target_price IS NOT NULL
         AND s.price_sgd IS NOT NULL
         AND s.price_sgd <= p.target_price
       ORDER BY p.id, s.price_sgd ASC`,
    )
    .all(runId) as {
    product_id: number;
    target_price: number;
    snapshot_id: number;
    link_id: number;
    price_sgd: number;
  }[];

  const hasOpenAlert = db.prepare(openAlertSql);
  const seen = new Set<number>();
  for (const hit of hits) {
    if (seen.has(hit.product_id)) continue; // rows are price-ordered, first per product is lowest
    seen.add(hit.product_id);
    if (hasOpenAlert.get(hit.product_id, 'target')) continue;
    insertAlert('target', hit.product_id, hit.link_id, hit.snapshot_id, hit.price_sgd, hit.target_price, null);
    console.log(`[alerts] product ${hit.product_id}: ${hit.price_sgd} SGD <= target ${hit.target_price}`);
  }
  return seen; // products whose target was hit this run (covered — skip below-range)
}

/**
 * Raise a 'below_range' alert when this run's lowest SGD price for a product
 * dips under the lower Tukey fence (Q1 - 1.5*IQR) of its own daily-lowest
 * price history. History is taken over the last WINDOW_DAYS, excluding the
 * current run so a new low can't widen the band it's being tested against.
 */
function evaluateBelowRangeAlerts(runId: number, skipProductIds: Set<number>): void {
  const currentLows = db
    .prepare(
      `SELECT p.id AS product_id, s.id AS snapshot_id, s.link_id, s.price_sgd
       FROM products p
       JOIN product_links l ON l.product_id = p.id AND l.is_active = 1
       JOIN price_snapshots s ON s.link_id = l.id AND s.run_id = ?
       WHERE p.is_active = 1 AND s.price_sgd IS NOT NULL
       ORDER BY p.id, s.price_sgd ASC`,
    )
    .all(runId) as { product_id: number; snapshot_id: number; link_id: number; price_sgd: number }[];

  const historyStmt = db.prepare(
    `SELECT MIN(s.price_sgd) AS low
     FROM price_snapshots s
     JOIN product_links l ON l.id = s.link_id AND l.is_active = 1
     WHERE l.product_id = ?
       AND s.price_sgd IS NOT NULL
       AND (s.run_id IS NULL OR s.run_id != ?)
       AND s.scraped_at > datetime('now', ?)
     GROUP BY date(s.scraped_at)
     ORDER BY low ASC`,
  );

  const hasOpenAlert = db.prepare(openAlertSql);
  const seen = new Set<number>();
  for (const cur of currentLows) {
    if (seen.has(cur.product_id)) continue; // first row per product is its lowest this run
    seen.add(cur.product_id);
    if (skipProductIds.has(cur.product_id)) continue; // target alert already covers it

    const dailyLows = (historyStmt.all(cur.product_id, runId, `-${WINDOW_DAYS} days`) as {
      low: number;
    }[]).map((r) => r.low);
    if (dailyLows.length < MIN_POINTS) continue; // not enough history to judge

    const q1 = quantile(dailyLows, 0.25);
    const q3 = quantile(dailyLows, 0.75);
    const lowerBound = q1 - IQR_MULT * (q3 - q1);
    if (lowerBound <= 0 || cur.price_sgd >= lowerBound) continue;
    if (hasOpenAlert.get(cur.product_id, 'below_range')) continue;

    const baseline = quantile(dailyLows, 0.5);
    insertAlert('below_range', cur.product_id, cur.link_id, cur.snapshot_id, cur.price_sgd, lowerBound, baseline);
    console.log(
      `[alerts] product ${cur.product_id}: ${cur.price_sgd.toFixed(2)} SGD below usual range ` +
        `(lower bound ${lowerBound.toFixed(2)}, typical ${baseline.toFixed(2)})`,
    );
  }
}

function insertAlert(
  kind: 'target' | 'below_range',
  productId: number,
  linkId: number,
  snapshotId: number,
  price: number,
  threshold: number,
  baseline: number | null,
): void {
  db.prepare(
    `INSERT INTO alerts (kind, product_id, link_id, snapshot_id, price, currency, target_price, baseline)
     VALUES (?, ?, ?, ?, ?, 'SGD', ?, ?)`,
  ).run(kind, productId, linkId, snapshotId, price, threshold, baseline);
}

/**
 * Linear-interpolation ("type 7") quantile over an ascending-sorted array.
 * Matches R/numpy defaults so the band lines up with what a chart would show.
 */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}
