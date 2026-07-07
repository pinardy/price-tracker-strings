import { db, firstRow, run } from './connection.js';
import { migrate } from './migrate.js';

// Handles, variant ids, and WooCommerce variation ids verified live against
// each store on 2026-07-07. If a store renames a product the fetch run will
// log an error for that link and it can be re-attached via the search UI.
interface SeedLink {
  providerId: string;
  externalId: string;
  variantId?: string;
  title: string;
  /** WooCommerce shops need explicit URLs; Shopify links derive from STORE_URLS. */
  url?: string;
}

const SEED: {
  name: string;
  instrument: 'violin' | 'viola' | 'cello' | 'bass';
  brand: string;
  variant_desc: string;
  links: SeedLink[];
}[] = [
  {
    name: 'Thomastik Dominant Violin Set (135B)',
    instrument: 'violin',
    brand: 'Thomastik-Infeld',
    variant_desc: '4/4, medium, steel E, ball end',
    links: [
      {
        providerId: 'fiddlershop',
        externalId: 'dominant-violin-set',
        variantId: '31569517838387',
        title: 'Thomastik Dominant Violin String Set — 4/4 / Medium / (135B) Chrome Steel / Ball',
      },
      {
        providerId: 'shar',
        externalId: 'thomastik-dominant-violin-set-ball-e-4-4-medium',
        variantId: '45603396485351',
        title: 'Thomastik-Infeld Dominant Violin String Set - Steel E - 4/4 Size - Medium Gauge',
      },
      {
        providerId: 'gramercy',
        externalId: 'thomastik-infeld-dominant-violin-set-medium-135b',
        variantId: '41108842446900',
        title: 'Thomastik-Infeld Dominant Violin Set Medium #135B — 4/4',
      },
      {
        providerId: 'synwin',
        externalId: '3475',
        title: 'Dominant Violin Strings with Perlon E — String: Set',
        url: 'https://www.synwin.com.sg/product/dominant-violin-strings-with-perlon-e/',
      },
      {
        providerId: 'lvl',
        externalId: '16834',
        title: 'Thomastik Dominant Violin Strings — Size: 4/4, String: Set',
        url: 'https://www.lvlmusicacademy.com/shop/violin-strings/thomastik-dominant-violin-strings/',
      },
    ],
  },
  {
    name: 'Pirastro Evah Pirazzi Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium, silvery steel E, ball end',
    links: [
      {
        providerId: 'fiddlershop',
        externalId: 'pirastro-evah-pirazzi-green-violin-string-set',
        variantId: '6872391680051',
        title: 'Pirastro Evah Pirazzi Violin String Set — Silvery Steel / Ball End / Medium / 4/4',
      },
      {
        providerId: 'shar',
        externalId: 'pirastro-evah-pirazzi-set-ball-e-4-4-medium',
        variantId: '45602239742183',
        title: 'Pirastro Evah Pirazzi Violin String Set - Silvery Steel E - 4/4 Size - Medium Gauge',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-evah-pirazzi-violin-medium-set-419521',
        variantId: '41109160919092',
        title: 'Pirastro Evah Pirazzi Violin Medium (Set) — "E" - BALL SET',
      },
    ],
  },
  {
    name: 'Pirastro Evah Pirazzi Gold Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium, silver G, ball end',
    links: [
      {
        providerId: 'fiddlershop',
        externalId: 'evah-pirazzi-gold-violin-string-set',
        variantId: '7108044390451',
        title: 'Pirastro Evah Pirazzi Gold Violin String Set — Silver G / Ball',
      },
      {
        providerId: 'shar',
        externalId: 'pirazzi-gold-violin-string-set-silver-g-ball-e',
        variantId: '45603741663463',
        title: 'Pirastro Evah Pirazzi Gold Violin String Set - Silver G - 4/4 Size - Medium Gauge',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-evah-pirazzi-gold-violin-medium-set',
        variantId: '41109137621044',
        title: 'Pirastro Evah Pirazzi Gold Violin Medium (Set) — G SILVER + E BALL',
      },
    ],
  },
  {
    name: 'Thomastik Dominant Viola Set',
    instrument: 'viola',
    brand: 'Thomastik-Infeld',
    variant_desc: '15"-16.5", medium',
    links: [
      {
        providerId: 'fiddlershop',
        externalId: 'dominant-viola-set-1',
        variantId: '8588739182643',
        title: 'Thomastik Dominant Viola String Set — 16" - 16.5" / Mittel (Medium)',
      },
      {
        providerId: 'shar',
        externalId: 'thomastik-dominant-viola-set-4-4-size-medium-gauge',
        variantId: '45603486335207',
        title: 'Thomastik Infeld Dominant Viola String Set - 15"-16.5" Size - Medium Gauge',
      },
      {
        providerId: 'gramercy',
        externalId: 'thomastik-infeld-dominant-viola-set-medium-141',
        variantId: '41020017639476',
        title: 'Thomastik-Infeld Dominant Viola Set Medium #141 — 4/4',
      },
    ],
  },
  {
    name: 'Larsen Original Cello A String',
    instrument: 'cello',
    brand: 'Larsen',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'fiddlershop',
        externalId: 'larsen-cello-a',
        variantId: '6799928688691',
        title: 'Larsen Original Cello A String — Medium',
      },
      {
        providerId: 'shar',
        externalId: 'larsen-cello-a-string',
        variantId: '45604173578471',
        title: 'Larsen Cello A String — Medium',
      },
      {
        providerId: 'gramercy',
        externalId: 'larsen-strings-original-cello-soft-medium-strong-loose',
        variantId: '41101392511028',
        title: 'Larsen Strings Original Cello (Loose) — "A" - MEDIUM',
      },
    ],
  },
  {
    name: 'Thomastik Spirocore Bass Orchestra Set',
    instrument: 'bass',
    brand: 'Thomastik-Infeld',
    variant_desc: '3/4, medium',
    links: [
      {
        providerId: 'fiddlershop',
        externalId: 'spirocore-bass-set-orchestra-tuning',
        variantId: '42546061639855',
        title: 'Thomastik Spirocore Bass Orchestra String Set — 3/4 / Medium',
      },
      {
        providerId: 'shar',
        externalId: 'thomastik-spirocore-bass-string-set-3-4-orchestra',
        variantId: '45605374066919',
        title: 'Thomastik-Infeld Spirocore Orchestra Double Bass String Set - 3/4 Size - Medium Gauge',
      },
    ],
  },
];

const STORE_URLS: Record<string, string> = {
  fiddlershop: 'https://fiddlershop.com',
  shar: 'https://www.sharmusic.com',
  gramercy: 'https://gramercy.com.sg',
};

await migrate();

function linkUrl(link: SeedLink): string {
  return link.url ?? `${STORE_URLS[link.providerId]}/products/${link.externalId}`;
}

// Idempotent additive seed: sequential awaits, re-running heals partial state.
let addedProducts = 0;
let addedLinks = 0;
for (const item of SEED) {
  const existing = await firstRow<{ id: number }>('SELECT id FROM products WHERE name = ?', [item.name]);
  const productId =
    existing?.id ??
    (
      await run(
        `INSERT INTO products (name, instrument, brand, variant_desc, target_currency)
         VALUES (?, ?, ?, ?, 'SGD')`,
        [item.name, item.instrument, item.brand, item.variant_desc],
      )
    ).lastId;
  if (!existing) addedProducts++;

  // Attach any seed link whose provider isn't linked yet, so new sources
  // reach previously seeded products too.
  for (const link of item.links) {
    const linked = await firstRow('SELECT 1 FROM product_links WHERE product_id = ? AND provider_id = ?', [
      productId,
      link.providerId,
    ]);
    if (linked) continue;
    await run(
      `INSERT INTO product_links (product_id, provider_id, external_id, variant_id, url, title)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, link.providerId, link.externalId, link.variantId ?? null, linkUrl(link), link.title],
    );
    addedLinks++;
  }
}

console.log(`[seed] added ${addedProducts} products, ${addedLinks} links`);
db.close();
