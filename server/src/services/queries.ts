import { db } from '../db/connection.js';

/** Latest snapshot per link, joined onto product links. */
const LINKS_WITH_LATEST = `
  SELECT l.*, s.price AS latest_price, s.currency AS latest_currency,
         s.price_sgd AS latest_price_sgd,
         s.in_stock AS latest_in_stock, s.scraped_at AS latest_scraped_at
  FROM product_links l
  LEFT JOIN price_snapshots s ON s.id = (
    SELECT id FROM price_snapshots WHERE link_id = l.id ORDER BY scraped_at DESC, id DESC LIMIT 1
  )`;

export function listProducts(): any[] {
  const products = db
    .prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC")
    .all() as any[];
  const links = db
    .prepare(`${LINKS_WITH_LATEST} WHERE l.is_active = 1`)
    .all() as any[];

  const byProduct = new Map<number, any[]>();
  for (const link of links) {
    (byProduct.get(link.product_id) ?? byProduct.set(link.product_id, []).get(link.product_id)!).push(link);
  }
  return products.map((p) => {
    const productLinks = byProduct.get(p.id) ?? [];
    const priced = productLinks.filter((l) => l.latest_price != null);
    // Rank in SGD. Links without a conversion yet (rate fetch never ran)
    // fall back to a single-currency comparison rather than mixing units.
    const converted = priced.filter((l) => l.latest_price_sgd != null);
    const lowest = converted.length
      ? converted.reduce((a, b) => (b.latest_price_sgd < a.latest_price_sgd ? b : a))
      : lowestSingleCurrency(priced);
    return {
      ...p,
      links: productLinks,
      lowest: lowest
        ? {
            price: lowest.latest_price,
            currency: lowest.latest_currency,
            price_sgd: lowest.latest_price_sgd ?? null,
            provider_id: lowest.provider_id,
            url: lowest.url,
          }
        : null,
    };
  });
}

function lowestSingleCurrency(priced: any[]): any | null {
  const pool = priced.filter((l) => l.latest_currency === priced[0]?.latest_currency);
  return pool.length ? pool.reduce((a, b) => (b.latest_price < a.latest_price ? b : a)) : null;
}

export function getProduct(id: number | string): any | null {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;
  const links = db
    .prepare(`${LINKS_WITH_LATEST} WHERE l.product_id = ? AND l.is_active = 1`)
    .all(id);
  return { ...(product as object), links };
}

export function getHistory(productId: number | string, days: number): any[] {
  return db
    .prepare(
      `SELECT s.link_id, l.provider_id, s.price, s.currency, s.price_sgd, s.scraped_at
       FROM price_snapshots s
       JOIN product_links l ON l.id = s.link_id
       WHERE l.product_id = ? AND s.scraped_at > datetime('now', ?)
       ORDER BY s.scraped_at ASC`,
    )
    .all(productId, `-${days} days`);
}

export function listAlerts(onlyOpen: boolean): any[] {
  return db
    .prepare(
      `SELECT a.*, p.name AS product_name, l.provider_id, l.url AS link_url
       FROM alerts a
       JOIN products p ON p.id = a.product_id
       LEFT JOIN product_links l ON l.id = a.link_id
       ${onlyOpen ? 'WHERE a.acknowledged = 0' : ''}
       ORDER BY a.created_at DESC LIMIT 200`,
    )
    .all();
}
