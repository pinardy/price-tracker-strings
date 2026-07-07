import * as cheerio from 'cheerio';
import { ProviderError } from '../lib/errors.js';
import type { FetchContext, LinkRef, PriceProvider, PriceResult, SearchResult } from './types.js';

const BASE_URL = 'https://www.thomann.de';
const HEADERS = { 'Accept-Language': 'en' };

/**
 * Thomann is server-rendered with microdata price markup. Prices geo-localize
 * by URL region path, so all URLs are pinned to /intl/ (EUR).
 */
export class ThomannProvider implements PriceProvider {
  readonly id = 'thomann';
  readonly label = 'Thomann';
  readonly kind = 'retailer' as const;

  enabled(): boolean {
    return true;
  }

  async search(query: string, ctx: FetchContext): Promise<SearchResult[]> {
    const url = `${BASE_URL}/intl/search_dir.html?sw=${encodeURIComponent(query)}`;
    const response = await ctx.fetch(url, { headers: HEADERS });
    if (!response.ok) throw new ProviderError(this.id, `search HTTP ${response.status}`);
    const $ = cheerio.load(await response.text());

    const results: SearchResult[] = [];
    $('.product').each((_, el) => {
      const $el = $(el);
      const href = $el.find('a').first().attr('href');
      const title = collapseWhitespace(
        $el.find('.product__title, .title').first().text() ||
          $el.find('img').first().attr('alt') ||
          '',
      );
      if (!href || !title) return;

      const absolute = new URL(href, `${BASE_URL}/intl/`);
      const path = pinIntl(absolute.pathname);
      // Search-page prices are injected by JS, so results carry no price;
      // it appears once the product is linked and fetched.
      results.push({
        providerId: this.id,
        externalId: path,
        title,
        url: `${BASE_URL}${path}`,
        imageUrl: $el.find('img').first().attr('data-src') || $el.find('source').first().attr('data-srcset') || undefined,
      });
    });
    return results.slice(0, 25);
  }

  async fetchPrice(link: LinkRef, ctx: FetchContext): Promise<PriceResult> {
    const path = link.externalId ?? new URL(link.url).pathname;
    const response = await ctx.fetch(`${BASE_URL}${pinIntl(path)}`, { headers: HEADERS });
    if (!response.ok) throw new ProviderError(this.id, `HTTP ${response.status} for ${path}`);
    const $ = cheerio.load(await response.text());

    const priceAttr = $('[itemprop=price]').first().attr('content') ?? $('[itemprop=price]').first().text();
    const price = parsePriceText(priceAttr);
    if (price == null) throw new ProviderError(this.id, `no microdata price on ${path}`);

    const currency = $('[itemprop=priceCurrency]').first().attr('content')?.trim() || 'EUR';
    const availability = $('[itemprop=availability]').first().attr('href') ?? $('[itemprop=availability]').first().attr('content');

    return {
      price,
      // Thomann localizes currency by viewer IP even on /intl/ — report
      // what the page says rather than assuming EUR.
      currency,
      inStock: availability ? /InStock/i.test(availability) : null,
      title:
        collapseWhitespace($('[itemprop=name]').first().text()) ||
        collapseWhitespace($('h1').first().text()) ||
        undefined,
    };
  }
}

/** Normalizes any region path (/de/, /us/, bare) to /intl/, dropping query params. */
function pinIntl(pathname: string): string {
  const clean = pathname.split('?')[0];
  if (/^\/[a-z]{2,4}\//.test(clean)) return clean.replace(/^\/[a-z]{2,4}\//, '/intl/');
  return `/intl${clean.startsWith('/') ? '' : '/'}${clean}`;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parsePriceText(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // "1.234,56" (EU) vs "1,234.56" (US) vs plain "63"
  const normalized = /,\d{1,2}$/.test(cleaned)
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

export { parsePriceText };
