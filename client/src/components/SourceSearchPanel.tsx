import { useState } from 'react';
import { api, formatPrice, ProviderSearchOutcome, SearchResult } from '../api';
import { ProviderTag } from './ProviderTag';

interface Props {
  /** Called when the per-source selection changes. */
  onSelectionChange: (picks: SearchResult[]) => void;
  initialQuery?: string;
}

/**
 * Searches every enabled source at once and lets the user pick at most one
 * matching result per source — this is how canonical products get linked
 * to concrete retailer listings.
 */
export function SourceSearchPanel({ onSelectionChange, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [outcomes, setOutcomes] = useState<ProviderSearchOutcome[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<Map<string, SearchResult>>(new Map());

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setOutcomes(null);
    try {
      setOutcomes(await api.search(query.trim()));
    } catch (err) {
      setOutcomes([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (result: SearchResult) => {
    const next = new Map(picks);
    const current = next.get(result.providerId);
    if (current && sameResult(current, result)) next.delete(result.providerId);
    else next.set(result.providerId, result);
    setPicks(next);
    onSelectionChange([...next.values()]);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          style={{ flex: 1 }}
          placeholder="e.g. dominant violin set 4/4 medium"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="primary" onClick={search} disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search all sources'}
        </button>
      </div>
      {loading && (
        <div className="muted">
          <span className="spinner" /> Searching each source (rate-limited politely, can take ~15s)…
        </div>
      )}
      {outcomes?.map((outcome) => (
        <div key={outcome.providerId} style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6 }}>
            <ProviderTag id={outcome.providerId} />
            {outcome.kind === 'marketplace' && (
              <span className="muted">tracks the lowest live listing for your query</span>
            )}
            {outcome.error && <span className="error-text">search failed: {outcome.error}</span>}
          </div>
          {outcome.results?.length === 0 && <div className="muted">No matches.</div>}
          {outcome.results?.slice(0, 8).map((result, i) => {
            const selected = picks.get(result.providerId);
            const isSelected = selected ? sameResult(selected, result) : false;
            return (
              <div
                key={`${result.externalId}-${result.variantId}-${i}`}
                className={`search-result${isSelected ? ' selected' : ''}`}
                onClick={() => toggle(result)}
              >
                {result.imageUrl && <img src={result.imageUrl} alt="" />}
                <div className="grow">
                  <div className="title">{result.title}</div>
                  <a
                    className="muted"
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    view on site ↗
                  </a>
                </div>
                {result.price != null && result.currency && (
                  <span className="price-chip">{formatPrice(result.price, result.currency)}</span>
                )}
                <input type="checkbox" checked={isSelected} readOnly />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function sameResult(a: SearchResult, b: SearchResult): boolean {
  return a.externalId === b.externalId && a.variantId === b.variantId && a.url === b.url;
}
