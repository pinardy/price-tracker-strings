import { Router } from 'express';
import { z } from 'zod';
import { allRows, batch, firstRow, run } from '../db/connection.js';
import { ah } from '../lib/asyncHandler.js';
import { background } from '../lib/background.js';
import { runFetch } from '../services/fetcher.js';
import { getHistory, getProduct, listProducts } from '../services/queries.js';

export const productsRouter = Router();

const linkPickSchema = z.object({
  providerId: z.string(),
  externalId: z.string().nullable().optional(),
  variantId: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  title: z.string().optional(),
  url: z.string().url(),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  instrument: z.enum(['violin', 'viola', 'cello', 'bass']),
  brand: z.string().optional(),
  variant_desc: z.string().optional(),
  target_price: z.number().positive().nullable().optional(),
  target_currency: z.string().default('SGD'),
  links: z.array(linkPickSchema).default([]),
});

const patchProductSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().nullable().optional(),
  variant_desc: z.string().nullable().optional(),
  target_price: z.number().positive().nullable().optional(),
  target_currency: z.string().optional(),
  is_active: z.boolean().optional(),
});

const INSERT_LINK_SQL = `
  INSERT INTO product_links (product_id, provider_id, external_id, variant_id, query, url, title)
  VALUES (?, ?, ?, ?, ?, ?, ?)`;

type LinkPick = z.infer<typeof linkPickSchema>;

function linkArgs(productId: number | string, link: LinkPick) {
  return [
    productId,
    link.providerId,
    link.externalId ?? null,
    link.variantId ?? null,
    link.query ?? null,
    link.url,
    link.title ?? null,
  ] as (string | number | null)[];
}

productsRouter.get('/', ah(async (_req, res) => {
  res.json(await listProducts());
}));

productsRouter.post('/', ah(async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { links, ...product } = parsed.data;

  const { lastId: productId } = await run(
    `INSERT INTO products (name, instrument, brand, variant_desc, target_price, target_currency)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      product.name,
      product.instrument,
      product.brand ?? null,
      product.variant_desc ?? null,
      product.target_price ?? null,
      product.target_currency,
    ],
  );

  let linkIds: number[] = [];
  if (links.length) {
    try {
      // batch() is atomic: either every link lands or none do.
      const results = await batch(links.map((link) => ({ sql: INSERT_LINK_SQL, args: linkArgs(productId, link) })));
      linkIds = results.map((r) => Number(r.lastInsertRowid ?? 0));
    } catch (err) {
      await run('DELETE FROM products WHERE id = ?', [productId]).catch(() => {});
      throw err;
    }
  }

  // Get first prices for the new links right away.
  if (linkIds.length) background(runFetch('manual', linkIds));

  res.status(201).json({ id: productId });
}));

productsRouter.get('/:id', ah(async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(product);
}));

productsRouter.patch('/:id', ah(async (req, res) => {
  const parsed = patchProductSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(typeof value === 'boolean' ? Number(value) : value);
  }
  if (!sets.length) {
    res.status(400).json({ error: 'no fields to update' });
    return;
  }
  const { changes } = await run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [
    ...values,
    req.params.id,
  ]);
  if (!changes) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(await firstRow('SELECT * FROM products WHERE id = ?', [req.params.id]));
}));

productsRouter.delete('/:id', ah(async (req, res) => {
  const { changes } = await run('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  if (!changes) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.status(204).end();
}));

productsRouter.get('/:id/history', ah(async (req, res) => {
  const days = Math.min(parseInt(String(req.query.days ?? '90'), 10) || 90, 3650);
  res.json(await getHistory(req.params.id, days));
}));

productsRouter.post('/:id/links', ah(async (req, res) => {
  const parsed = linkPickSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const product = await firstRow('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!product) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const { lastId } = await run(INSERT_LINK_SQL, linkArgs(req.params.id, parsed.data));
  background(runFetch('manual', [lastId]));
  res.status(201).json({ id: lastId });
}));
