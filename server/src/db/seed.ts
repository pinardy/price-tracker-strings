import { db } from './connection.js';
import { migrate } from './migrate.js';

// Handles, variant ids, and WooCommerce variation ids verified live against
// each store when their entry was added (2026-07-07 for the original six
// products, 2026-07-08 for everything added since). If a store renames a product the fetch run will
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
      {
        providerId: 'synwin',
        externalId: '3628',
        title: 'Evah Pirazzi Violin Strings — String: Set with E silvery steel ball-end, Size: 4/4',
        url: 'https://www.synwin.com.sg/product/evah-pirazzi-violin-strings/',
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
      // No Synwin link: Synwin's only EP Gold set variations (4134/4135, SKU
      // 415021/415025) are the gold-G sets, not comparable to this silver-G product.
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
      {
        providerId: 'synwin',
        externalId: '3817',
        title: 'Dominant Viola Strings — String: Set, Size: 16"',
        url: 'https://www.synwin.com.sg/product/dominant-viola-strings/',
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
      {
        providerId: 'synwin',
        externalId: '4421',
        title: 'Larsen Cello Strings — String: A',
        url: 'https://www.synwin.com.sg/product/larsen-cello-strings/',
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
      {
        providerId: 'synwin',
        externalId: '4233',
        title: 'Spirocore Double Bass Strings — String: Set, Size: 3/4',
        url: 'https://www.synwin.com.sg/product/spirocore-double-bass-strings/',
      },
    ],
  },
  // Products added 2026-07-08, each linked to every SG source that carries
  // the same variant (Synwin, Gramercy, LVL). Zyex and Versum sets are
  // Synwin-only: Gramercy stocks only loose Zyex strings and the Versum
  // *Solo* set; LVL only Versum A/D singles.
  {
    name: 'Thomastik Peter Infeld (PI) Violin Set',
    instrument: 'violin',
    brand: 'Thomastik-Infeld',
    variant_desc: '4/4, medium, platinum E',
    links: [
      {
        providerId: 'synwin',
        externalId: '3909',
        title: 'Peter Infeld Violin Strings — String: Set with platinum E',
        url: 'https://www.synwin.com.sg/product/peter-infeld-violin-strings-2/',
      },
      {
        providerId: 'gramercy',
        externalId: 'thomastik-infeld-peter-infeld-violin-set-medium-pi100',
        variantId: '41108908376116',
        title: 'Thomastik-Infeld Peter Infeld Violin Set Medium — "E" PLATINIUM SET #PI100',
      },
      {
        providerId: 'lvl',
        externalId: '25451',
        title: 'Peter Infeld Violin Strings — String: Set with platinum E',
        url: 'https://www.lvlmusicacademy.com/shop/violin-strings/peter-infeld-violin-strings/',
      },
    ],
  },
  {
    name: 'Pirastro Obligato Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium, gold E, ball end',
    links: [
      {
        providerId: 'synwin',
        externalId: '3866',
        title: 'Obligato Violin Strings — String: Set with gold E ball-end',
        url: 'https://www.synwin.com.sg/product/obligato-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-obligato-violin-medium-set',
        variantId: '41109231370292',
        title: 'Pirastro Obligato Violin Medium (Set) — #411021 SET',
      },
    ],
  },
  {
    name: 'Pirastro Tonica Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '3345',
        title: 'Tonica Violin Strings — String: Set, Size: 4/4',
        url: 'https://www.synwin.com.sg/product/tonica-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-tonica-violin-medium-set-412021',
        variantId: '41109271969844',
        title: 'Pirastro Tonica Violin Medium (Set) — 4/4',
      },
      {
        providerId: 'lvl',
        externalId: '18149',
        title: 'Pirastro Tonica Violin Strings — Size: 4/4, String: Set',
        url: 'https://www.lvlmusicacademy.com/shop/violin-strings/pirastro-tonica-violin-strings/',
      },
    ],
  },
  {
    name: 'Pirastro Passione Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium, ball end E',
    links: [
      {
        providerId: 'synwin',
        externalId: '8853',
        title: 'Passione Violin Strings — String: Set with ball-end E',
        url: 'https://www.synwin.com.sg/product/passione-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-passione-violin-set-medium-219081',
        variantId: '41109268856884',
        title: 'Pirastro Passione Violin Set Medium — #219021 "E" BALL SET',
      },
    ],
  },
  {
    name: 'Pirastro Perpetual Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '7085',
        title: 'Perpetual Violin Strings Set — String: Set',
        url: 'https://www.synwin.com.sg/product/perpetual-violin-strings-set/',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-perpetual-violin-set-medium-41a021',
        variantId: '40645988581428',
        title: 'Pirastro Perpetual Violin Set Medium',
      },
    ],
  },
  {
    name: 'Thomastik Rondo Violin Set',
    instrument: 'violin',
    brand: 'Thomastik-Infeld',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '5654',
        title: 'Rondo® Violin Strings — String: Set',
        url: 'https://www.synwin.com.sg/product/rondo-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'thomastik-infeld-rondo-violin-set-4-4-medium-ro100',
        variantId: '45934209171508',
        title: 'Thomastik-Infeld Rondo Violin Set 4/4 Medium #RO100',
      },
    ],
  },
  {
    name: 'Pirastro Evah Pirazzi Neo Violin Set',
    instrument: 'violin',
    brand: 'Pirastro',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '9701',
        title: 'Evah Pirazzi Neo Violin Strings',
        url: 'https://www.synwin.com.sg/product/evah-pirazzi-neo-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'pirastro-evah-pirazzi-neo-violin-set-4-4-synthetic-core-medium-41b021',
        variantId: '47141723045940',
        title: 'Pirastro Evah Pirazzi Neo Violin Set 4/4 Synthetic Core Medium',
      },
    ],
  },
  {
    name: 'Larsen Magnacore Cello Set',
    instrument: 'cello',
    brand: 'Larsen',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '4078',
        title: 'Larsen Magnacore Cello Strings — String: Set',
        url: 'https://www.synwin.com.sg/product/larsen-magnacore-cello-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'larsen-strings-magnacore-cello-set-medium-334905',
        variantId: '40646025740340',
        title: 'Larsen Strings Magnacore Cello Set Medium',
      },
    ],
  },
  {
    name: 'Thomastik Versum Cello Set',
    instrument: 'cello',
    brand: 'Thomastik-Infeld',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '3800',
        title: 'Versum Cello Strings — String: Set',
        url: 'https://www.synwin.com.sg/product/versum-cello-strings/',
      },
    ],
  },
  {
    name: 'Thomastik Spirocore Cello Tungsten G+C',
    instrument: 'cello',
    brand: 'Thomastik-Infeld',
    variant_desc: '4/4, tungsten',
    links: [
      {
        providerId: 'synwin',
        externalId: '4062',
        title: 'Spirocore Cello Tungsten Strings — String: G + C',
        url: 'https://www.synwin.com.sg/product/spirocore-cello-tungsten-strings/',
      },
      {
        providerId: 'lvl',
        externalId: '24363',
        title: 'Spirocore Tungsten Cello Strings — String: G + C',
        url: 'https://www.lvlmusicacademy.com/shop/cello-strings/spirocore-tungsten-cello-strings/',
      },
    ],
  },
  {
    name: 'Jargar Cello Set',
    instrument: 'cello',
    brand: 'Jargar',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '4003',
        title: 'Jargar Cello Strings — String: Set, Tension: Medium',
        url: 'https://www.synwin.com.sg/product/jargar-cello-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'jargar-strings-classic-cello-medium',
        variantId: '41100269420596',
        title: 'Jargar Strings Classic Cello Medium — #J5555 - 4/4 MEDIUM SET',
      },
    ],
  },
  {
    name: 'Thomastik Alphayue Violin Set',
    instrument: 'violin',
    brand: 'Thomastik-Infeld',
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '3073',
        title: 'Alphayue Violin Strings — String: Set, Size: 4/4',
        url: 'https://www.synwin.com.sg/product/alphayue-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'thomastik-infeld-alphayue-violin-set-4-4-synthetic-core-medium-al100',
        variantId: '47141573427252',
        title: 'Thomastik-Infeld Alphayue Violin Set 4/4 Synthetic Core Medium',
      },
    ],
  },
  {
    name: "D'Addario Prelude Violin Set",
    instrument: 'violin',
    brand: "D'Addario",
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '6236',
        title: 'Prelude Violin Strings — String: Set, Size: 4/4',
        url: 'https://www.synwin.com.sg/product/prelude-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'daddario-prelude-violin-set-medium-j810',
        variantId: '40646130008116',
        title: "D'Addario Prelude Violin Set Medium #J810 — 4/4",
      },
    ],
  },
  {
    name: "D'Addario Zyex Violin Set",
    instrument: 'violin',
    brand: "D'Addario",
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '3519',
        title: 'Zyex Violin Strings — String: Set',
        url: 'https://www.synwin.com.sg/product/zyex-violin-strings/',
      },
    ],
  },
  {
    name: "D'Addario Helicore Violin Set",
    instrument: 'violin',
    brand: "D'Addario",
    variant_desc: '4/4, medium',
    links: [
      {
        providerId: 'synwin',
        externalId: '3494',
        title: 'Helicore Violin Strings — String: Set',
        url: 'https://www.synwin.com.sg/product/helicore-violin-strings/',
      },
      {
        providerId: 'gramercy',
        externalId: 'daddario-helicore-violin-set-medium-h310',
        variantId: '41099287887924',
        title: "D'Addario Helicore Violin Set Medium #H310 — H310 4/4 (set)",
      },
    ],
  },
];

const STORE_URLS: Record<string, string> = {
  fiddlershop: 'https://fiddlershop.com',
  shar: 'https://www.sharmusic.com',
  gramercy: 'https://gramercy.com.sg',
};

migrate();

const insertProduct = db.prepare(
  `INSERT INTO products (name, instrument, brand, variant_desc, target_currency)
   VALUES (?, ?, ?, ?, 'SGD')`,
);
const insertLink = db.prepare(
  `INSERT INTO product_links (product_id, provider_id, external_id, variant_id, url, title)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const findProduct = db.prepare('SELECT id FROM products WHERE name = ?');
const linkExists = db.prepare(
  'SELECT 1 FROM product_links WHERE product_id = ? AND provider_id = ?',
);

function linkUrl(link: SeedLink): string {
  return link.url ?? `${STORE_URLS[link.providerId]}/products/${link.externalId}`;
}

let addedProducts = 0;
let addedLinks = 0;
db.transaction(() => {
  for (const item of SEED) {
    const existing = findProduct.get(item.name) as { id: number } | undefined;
    const productId =
      existing?.id ??
      (insertProduct.run(item.name, item.instrument, item.brand, item.variant_desc)
        .lastInsertRowid as number);
    if (!existing) addedProducts++;

    // Additive: attach any seed link whose provider isn't linked yet, so new
    // sources reach previously seeded products too.
    for (const link of item.links) {
      if (linkExists.get(productId, link.providerId)) continue;
      insertLink.run(
        productId,
        link.providerId,
        link.externalId,
        link.variantId ?? null,
        linkUrl(link),
        link.title,
      );
      addedLinks++;
    }
  }
})();

console.log(`[seed] added ${addedProducts} products, ${addedLinks} links`);
