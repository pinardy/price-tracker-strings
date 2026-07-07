import { db } from './connection.js';
import { migrate } from './migrate.js';

// Handles and variant ids verified live against both stores' Shopify JSON
// on 2026-07-07. If a store renames a product the fetch run will log an
// error for that link and it can be re-attached via the Add Product search.
const SEED: {
  name: string;
  instrument: 'violin' | 'viola' | 'cello' | 'bass';
  brand: string;
  variant_desc: string;
  links: {
    providerId: 'fiddlershop' | 'shar';
    externalId: string;
    variantId: string;
    title: string;
  }[];
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
};

migrate();

const insertProduct = db.prepare(
  `INSERT INTO products (name, instrument, brand, variant_desc) VALUES (?, ?, ?, ?)`,
);
const insertLink = db.prepare(
  `INSERT INTO product_links (product_id, provider_id, external_id, variant_id, url, title)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const productExists = db.prepare('SELECT 1 FROM products WHERE name = ?');

let added = 0;
db.transaction(() => {
  for (const item of SEED) {
    if (productExists.get(item.name)) continue;
    const productId = insertProduct.run(item.name, item.instrument, item.brand, item.variant_desc)
      .lastInsertRowid as number;
    for (const link of item.links) {
      insertLink.run(
        productId,
        link.providerId,
        link.externalId,
        link.variantId,
        `${STORE_URLS[link.providerId]}/products/${link.externalId}`,
        link.title,
      );
    }
    added++;
  }
})();

console.log(`[seed] added ${added} products (${SEED.length - added} already present)`);
