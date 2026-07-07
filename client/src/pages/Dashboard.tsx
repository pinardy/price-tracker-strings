import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDualPrice, formatPrice, IS_STATIC, Product } from '../api';
import { ProviderTag } from '../components/ProviderTag';

const STALE_HOURS = 36;

export function Dashboard({ dataVersion }: { dataVersion: number }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    api.products().then(setProducts).catch((err) => setError(String(err)));
  }, [dataVersion]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    return products.filter((p) => {
      const haystack = `${p.name} ${p.brand ?? ''} ${p.variant_desc ?? ''} ${p.instrument}`.toLowerCase();
      if (!tokens.every((t) => haystack.includes(t))) return false;
      // Price filter compares the current lowest SGD price.
      const price = p.lowest?.price_sgd;
      if (Number.isFinite(min) && (price == null || price < min)) return false;
      if (Number.isFinite(max) && (price == null || price > max)) return false;
      return true;
    });
  }, [products, query, minPrice, maxPrice]);

  if (error) return <div className="card error-text">Failed to load products: {error}</div>;
  if (!products || !filtered) return <div className="card muted">Loading…</div>;
  if (!products.length) {
    return (
      <div className="card">
        {IS_STATIC ? (
          'No products tracked yet.'
        ) : (
          <>
            No products tracked yet. <Link to="/add">Add your first string set</Link> or run{' '}
            <code>npm run seed</code> for a starter catalog.
          </>
        )}
      </div>
    );
  }

  const filtersActive = query || minPrice || maxPrice;

  return (
    <div className="card table-scroll">
      <div className="filter-bar">
        <input
          type="search"
          className="filter-search"
          placeholder="Search by name, brand, or instrument…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="muted">
          Price S$
          <input
            type="number"
            min="0"
            step="1"
            className="filter-price"
            placeholder="min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </label>
        <span className="muted">–</span>
        <input
          type="number"
          min="0"
          step="1"
          className="filter-price"
          placeholder="max"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        {filtersActive && (
          <>
            <span className="muted">
              {filtered.length} of {products.length}
            </span>
            <button
              className="small"
              onClick={() => {
                setQuery('');
                setMinPrice('');
                setMaxPrice('');
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>
      {!filtered.length && <p className="muted">No products match the current filters.</p>}
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Lowest now</th>
            <th>Prices by source</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td>
                <Link to={`/products/${p.id}`}><strong>{p.name}</strong></Link>{' '}
                <span className="instrument-pill">{p.instrument}</span>
                {p.variant_desc && <div className="muted">{p.variant_desc}</div>}
              </td>
              <td>
                {p.lowest ? (
                  <>
                    <span className="price-chip lowest">
                      {formatDualPrice(p.lowest.price_sgd, p.lowest.price, p.lowest.currency)}
                    </span>
                    <div className="muted">
                      at <a href={p.lowest.url} target="_blank" rel="noreferrer">{p.lowest.provider_id}</a>
                    </div>
                  </>
                ) : (
                  <span className="muted">no data yet</span>
                )}
              </td>
              <td>
                {p.links.map((l) => (
                  <div key={l.id} style={{ marginBottom: 4 }}>
                    <ProviderTag id={l.provider_id} />
                    {l.latest_price != null ? (
                      <span className="price-chip" title={l.latest_scraped_at ?? ''}>
                        {formatDualPrice(l.latest_price_sgd, l.latest_price, l.latest_currency!)}
                        {l.latest_in_stock === 0 && <span className="error-text"> (out of stock)</span>}
                        {isStale(l.latest_scraped_at) && <span className="muted" title="price data is old"> ⏱</span>}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
                ))}
              </td>
              <td>
                {p.target_price != null ? (
                  <span
                    className="price-chip"
                    style={
                      p.lowest?.price_sgd != null && p.lowest.price_sgd <= p.target_price
                        ? { background: '#dcfce7', color: '#166534' }
                        : undefined
                    }
                  >
                    ≤ {formatPrice(p.target_price, 'SGD')}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isStale(scrapedAt: string | null): boolean {
  if (!scrapedAt) return false;
  return Date.now() - new Date(scrapedAt + 'Z').getTime() > STALE_HOURS * 3600 * 1000;
}
