import { allRows, firstRow } from '../db/connection.js';

/** Latest snapshot per link, joined onto product links. */
const LINKS_WITH_LATEST = `
  SELECT l.*, s.price AS latest_price, s.currency AS latest_currency,
         s.price_sgd AS latest_price_sgd,
         s.in_stock AS latest_in_stock, s.scraped_at AS latest_scraped_at
  FROM product_links l
  LEFT JOIN price_snapshots s ON s.id = (
    SELECT id FROM price_snapshots WHERE link_id = l.id ORDER BY scraped_at DESC, id DESC LIMIT 1
  )`;

export async function listProducts(): Promise<any[]> {
  const [products, links, rulesByProduct] = await Promise.all([
    allRows("SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC"),
    allRows(`${LINKS_WITH_LATEST} WHERE l.is_active = 1`),
    groupRules(),
  ]);

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
      rules: rulesByProduct.get(p.id) ?? [],
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

async function groupRules(productId?: number | string): Promise<Map<number, any[]>> {
  const rows = productId != null
    ? await allRows(
        'SELECT id, product_id, threshold_sgd FROM alert_rules WHERE product_id = ? ORDER BY threshold_sgd',
        [productId],
      )
    : await allRows('SELECT id, product_id, threshold_sgd FROM alert_rules ORDER BY threshold_sgd');
  const grouped = new Map<number, any[]>();
  for (const row of rows) {
    (grouped.get(row.product_id) ?? grouped.set(row.product_id, []).get(row.product_id)!).push(row);
  }
  return grouped;
}

function lowestSingleCurrency(priced: any[]): any | null {
  const pool = priced.filter((l) => l.latest_currency === priced[0]?.latest_currency);
  return pool.length ? pool.reduce((a, b) => (b.latest_price < a.latest_price ? b : a)) : null;
}

export async function getProduct(id: number | string): Promise<any | null> {
  const product = await firstRow('SELECT * FROM products WHERE id = ?', [id]);
  if (!product) return null;
  const [links, rulesByProduct] = await Promise.all([
    allRows(`${LINKS_WITH_LATEST} WHERE l.product_id = ? AND l.is_active = 1`, [id]),
    groupRules(id),
  ]);
  return { ...product, links, rules: rulesByProduct.get(Number(id)) ?? [] };
}

export async function getHistory(productId: number | string, days: number): Promise<any[]> {
  return allRows(
    `SELECT s.link_id, l.provider_id, s.price, s.currency, s.price_sgd, s.scraped_at
     FROM price_snapshots s
     JOIN product_links l ON l.id = s.link_id
     WHERE l.product_id = ? AND s.scraped_at > datetime('now', ?)
     ORDER BY s.scraped_at ASC`,
    [productId, `-${days} days`],
  );
}

export async function listAlerts(onlyOpen: boolean): Promise<any[]> {
  return allRows(
    `SELECT a.*, p.name AS product_name, l.provider_id, l.url AS link_url
     FROM alerts a
     JOIN products p ON p.id = a.product_id
     LEFT JOIN product_links l ON l.id = a.link_id
     ${onlyOpen ? 'WHERE a.acknowledged = 0' : ''}
     ORDER BY a.created_at DESC LIMIT 200`,
  );
}
