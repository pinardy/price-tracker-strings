import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDualPrice, formatPrice, IS_STATIC, Product } from '../api';
import { PROVIDER_LABELS, ProviderTag } from '../components/ProviderTag';

const STALE_HOURS = 36;

export function Dashboard({ dataVersion }: { dataVersion: number }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [source, setSource] = useState('');
  const [instrument, setInstrument] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    api.products().then(setProducts).catch((err) => setError(String(err)));
  }, [dataVersion]);

  const sources = useMemo(() => {
    const ids = new Set<string>();
    for (const p of products ?? []) for (const l of p.links) ids.add(l.provider_id);
    return [...ids].sort();
  }, [products]);

  const instruments = useMemo(() => {
    const order = ['violin', 'viola', 'cello', 'bass'];
    const present = new Set((products ?? []).map((p) => p.instrument));
    return order.filter((i) => present.has(i as Product['instrument']));
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    return products.filter((p) => {
      const haystack = `${p.name} ${p.brand ?? ''} ${p.variant_desc ?? ''} ${p.instrument}`.toLowerCase();
      if (!tokens.every((t) => haystack.includes(t))) return false;
      if (instrument && p.instrument !== instrument) return false;
      if (source && !p.links.some((l) => l.provider_id === source)) return false;
      // Price filter compares the current lowest SGD price.
      const price = p.lowest?.price_sgd;
      if (Number.isFinite(min) && (price == null || price < min)) return false;
      if (Number.isFinite(max) && (price == null || price > max)) return false;
      return true;
    });
  }, [products, query, minPrice, maxPrice, source, instrument]);

  const sorted = useMemo(() => {
    if (!filtered) return null;
    if (sort === 'newest') return filtered; // server order: created_at DESC
    const rows = [...filtered];
    const price = (p: Product) => p.lowest?.price_sgd ?? null;
    if (sort === 'price-asc' || sort === 'price-desc') {
      rows.sort((a, b) => {
        const pa = price(a);
        const pb = price(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1; // unpriced rows always last
        if (pb == null) return -1;
        return sort === 'price-asc' ? pa - pb : pb - pa;
      });
    } else if (sort === 'name') {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    return rows;
  }, [filtered, sort]);

  if (error) return <div className="card error-text">Failed to load products: {error}</div>;
  if (!products || !filtered || !sorted) return <div className="card muted">Loading…</div>;
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

  const filtersActive = query || minPrice || maxPrice || source || instrument;

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
        <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
          <option value="">All instruments</option>
          {instruments.map((i) => (
            <option key={i} value={i}>
              {i === 'bass' ? 'Double bass' : i[0].toUpperCase() + i.slice(1)}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((id) => (
            <option key={id} value={id}>
              {PROVIDER_LABELS[id] ?? id}
            </option>
          ))}
        </select>
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
        <select value={sort} onChange={(e) => setSort(e.target.value)} title="Sort">
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
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
                setSource('');
                setInstrument('');
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>
      {!filtered.length && <p className="muted">No products match the current filters.</p>}
      <table className="responsive-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Lowest now</th>
            <th>Prices by source</th>
            <th>Alerts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td data-label="Product">
                <Link to={`/products/${p.id}`}><strong>{p.name}</strong></Link>{' '}
                <span className="instrument-pill">{p.instrument}</span>
                {p.variant_desc && <div className="muted">{p.variant_desc}</div>}
              </td>
              <td data-label="Lowest now">
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
              <td data-label="Prices by source">
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
              <td data-label="Alerts">
                {p.rules.length ? (
                  p.rules.map((rule) => (
                    <div key={rule.id} style={{ marginBottom: 4 }}>
                      <span
                        className="price-chip"
                        style={
                          p.lowest?.price_sgd != null && p.lowest.price_sgd <= rule.threshold_sgd
                            ? { background: '#dcfce7', color: '#166534' }
                            : undefined
                        }
                      >
                        ≤ {formatPrice(rule.threshold_sgd, 'SGD')}
                      </span>
                    </div>
                  ))
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
