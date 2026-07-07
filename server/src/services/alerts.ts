import { db } from '../db/connection.js';

/**
 * After a fetch run, fire an alert for each alert rule whose product has a
 * snapshot in that run at or below the rule's SGD threshold. Deduped per
 * rule: a rule with an unacknowledged alert doesn't fire again.
 */
export function evaluateAlerts(runId: number): void {
  const hits = db
    .prepare(
      `SELECT r.id AS rule_id, r.product_id, r.threshold_sgd,
              s.id AS snapshot_id, s.link_id, s.price_sgd
       FROM alert_rules r
       JOIN products p ON p.id = r.product_id AND p.is_active = 1
       JOIN product_links l ON l.product_id = r.product_id AND l.is_active = 1
       JOIN price_snapshots s ON s.link_id = l.id AND s.run_id = ?
       WHERE s.price_sgd IS NOT NULL
         AND s.price_sgd <= r.threshold_sgd
       ORDER BY r.id, s.price_sgd ASC`,
    )
    .all(runId) as {
    rule_id: number;
    product_id: number;
    threshold_sgd: number;
    snapshot_id: number;
    link_id: number;
    price_sgd: number;
  }[];

  const hasOpenAlert = db.prepare(
    'SELECT 1 FROM alerts WHERE rule_id = ? AND acknowledged = 0 LIMIT 1',
  );
  const insertAlert = db.prepare(
    `INSERT INTO alerts (product_id, link_id, snapshot_id, rule_id, price, currency, target_price)
     VALUES (?, ?, ?, ?, ?, 'SGD', ?)`,
  );

  const seen = new Set<number>();
  for (const hit of hits) {
    if (seen.has(hit.rule_id)) continue; // rows are price-ordered, first per rule is lowest
    seen.add(hit.rule_id);
    if (hasOpenAlert.get(hit.rule_id)) continue;
    insertAlert.run(
      hit.product_id,
      hit.link_id,
      hit.snapshot_id,
      hit.rule_id,
      hit.price_sgd,
      hit.threshold_sgd,
    );
    console.log(
      `[alerts] rule ${hit.rule_id} (product ${hit.product_id}): ${hit.price_sgd} SGD <= ${hit.threshold_sgd}`,
    );
  }
}
