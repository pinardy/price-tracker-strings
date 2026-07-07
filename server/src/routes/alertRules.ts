import { Router } from 'express';
import { z } from 'zod';
import { allRows, firstRow, run } from '../db/connection.js';
import { ah } from '../lib/asyncHandler.js';

export const alertRulesRouter = Router();

const createSchema = z.object({
  product_id: z.number().int().positive(),
  threshold_sgd: z.number().positive(),
});

const patchSchema = z.object({
  threshold_sgd: z.number().positive(),
});

/** Rules with product context and the product's current lowest SGD price. */
const LIST_SQL = `
  SELECT r.id, r.product_id, r.threshold_sgd, r.created_at,
         p.name AS product_name, p.instrument,
         (SELECT MIN(s.price_sgd)
          FROM price_snapshots s
          JOIN product_links l ON l.id = s.link_id AND l.product_id = r.product_id AND l.is_active = 1
          WHERE s.id = (SELECT id FROM price_snapshots
                        WHERE link_id = l.id ORDER BY scraped_at DESC, id DESC LIMIT 1)
         ) AS lowest_price_sgd
  FROM alert_rules r
  JOIN products p ON p.id = r.product_id
  WHERE p.is_active = 1`;

alertRulesRouter.get('/', ah(async (_req, res) => {
  res.json(await allRows(`${LIST_SQL} ORDER BY r.created_at DESC, r.id DESC`));
}));

alertRulesRouter.post('/', ah(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const product = await firstRow('SELECT 1 FROM products WHERE id = ? AND is_active = 1', [
    parsed.data.product_id,
  ]);
  if (!product) {
    res.status(404).json({ error: 'product not found' });
    return;
  }
  const { lastId } = await run('INSERT INTO alert_rules (product_id, threshold_sgd) VALUES (?, ?)', [
    parsed.data.product_id,
    parsed.data.threshold_sgd,
  ]);
  res.status(201).json({ id: lastId });
}));

alertRulesRouter.patch('/:id', ah(async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { changes } = await run('UPDATE alert_rules SET threshold_sgd = ? WHERE id = ?', [
    parsed.data.threshold_sgd,
    req.params.id,
  ]);
  if (!changes) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(await firstRow(`${LIST_SQL} AND r.id = ?`, [req.params.id]));
}));

alertRulesRouter.delete('/:id', ah(async (req, res) => {
  const { changes } = await run('DELETE FROM alert_rules WHERE id = ?', [req.params.id]);
  if (!changes) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(204).end();
}));
