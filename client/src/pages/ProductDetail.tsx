import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDualPrice, formatPrice, IS_STATIC, Product, ProductLink, Review, SearchResult, HistoryPoint } from '../api';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import { ProviderTag } from '../components/ProviderTag';
import { SourceSearchPanel } from '../components/SourceSearchPanel';
import { StarPicker, Stars } from '../components/Stars';

const RANGES = [30, 90, 365];

export function ProductDetail({ dataVersion }: { dataVersion: number }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Omit<Product, 'lowest'> | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [days, setDays] = useState(90);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [pendingPicks, setPendingPicks] = useState<SearchResult[]>([]);
  const [targetInput, setTargetInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    api.product(id).then((p) => {
      setProduct(p);
      setTargetInput(p.target_price != null ? String(p.target_price) : '');
    }).catch((err) => setError(String(err)));
    api.history(id, days).then(setHistory).catch(() => {});
    api.reviews(id).then(setReviews).catch(() => {});
  }, [id, days]);

  useEffect(load, [load, dataVersion]);

  const marketplaceLinkIds = useMemo(
    () => new Set((product?.links ?? []).filter((l) => l.provider_id === 'reverb').map((l) => l.id)),
    [product],
  );

  if (error) return <div className="card error-text">{error}</div>;
  if (!product) return <div className="card muted">Loading…</div>;

  const saveTarget = async () => {
    const value = targetInput.trim() ? parseFloat(targetInput) : null;
    await api.patchProduct(product.id, { target_price: value });
    load();
  };

  const removeProduct = async () => {
    if (!window.confirm(`Stop tracking "${product.name}"? Price history is kept.`)) return;
    await api.deleteProduct(product.id);
    navigate('/');
  };

  const addPickedLinks = async () => {
    for (const pick of pendingPicks) {
      await api.addLink(product.id, pick);
    }
    setShowLinkSearch(false);
    setPendingPicks([]);
    load();
  };

  const removeLink = async (link: ProductLink) => {
    if (!window.confirm(`Remove ${link.provider_id} link? Its history is kept.`)) return;
    await api.removeLink(link.id);
    load();
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{product.name}</h2>
          <span className="instrument-pill">{product.instrument}</span>
          <span style={{ flex: 1 }} />
          {!IS_STATIC && <button className="small" onClick={removeProduct}>Stop tracking</button>}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {[product.brand, product.variant_desc].filter(Boolean).join(' · ')}
          {' · '}<Link to="/">back to dashboard</Link>
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Price history</h3>
          {RANGES.map((r) => (
            <button
              key={r}
              className="small"
              style={days === r ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
              onClick={() => setDays(r)}
            >
              {r}d
            </button>
          ))}
        </div>
        <PriceHistoryChart history={history} marketplaceLinkIds={marketplaceLinkIds} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Price-drop alert</h3>
        {IS_STATIC ? (
          <p className="muted" style={{ margin: 0 }}>
            {product.target_price != null
              ? <>Alerts fire when any price is at or below <strong>{formatPrice(product.target_price, 'SGD')}</strong>.</>
              : 'No target price set.'}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted">Alert when any price (converted to SGD) is at or below S$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              style={{ width: 120 }}
              placeholder="no target"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
            />
            <button className="primary small" onClick={saveTarget}>Save</button>
            {product.target_price != null && (
              <button className="small" onClick={() => { setTargetInput(''); void api.patchProduct(product.id, { target_price: null }).then(load); }}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: 1 }}>Sources ({product.links.length})</h3>
          {!IS_STATIC && (
            <button className="small" onClick={() => setShowLinkSearch((s) => !s)}>
              {showLinkSearch ? 'Cancel' : '+ Add source'}
            </button>
          )}
        </div>
        <table className="responsive-table">
          <thead>
            <tr><th>Source</th><th>Listing</th><th>Latest price</th>{!IS_STATIC && <th />}</tr>
          </thead>
          <tbody>
            {product.links.map((link) => (
              <tr key={link.id}>
                <td data-label="Source"><ProviderTag id={link.provider_id} /></td>
                <td data-label="Listing">
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.title ?? link.query ?? link.url}
                  </a>
                  {link.query && <div className="muted">tracked query: “{link.query}”</div>}
                </td>
                <td data-label="Latest price">
                  {link.latest_price != null ? (
                    <>
                      <span className="price-chip">
                        {formatDualPrice(link.latest_price_sgd, link.latest_price, link.latest_currency!)}
                      </span>
                      {link.latest_in_stock === 0 && <div className="error-text">out of stock</div>}
                      <div className="muted">{link.latest_scraped_at && new Date(link.latest_scraped_at + 'Z').toLocaleString()}</div>
                    </>
                  ) : (
                    <span className="muted">not fetched yet</span>
                  )}
                </td>
                {!IS_STATIC && (
                  <td><button className="small" onClick={() => removeLink(link)}>Remove</button></td>
                )}
              </tr>
            ))}
            {!product.links.length && (
              <tr><td colSpan={IS_STATIC ? 3 : 4} className="muted">No sources linked yet.</td></tr>
            )}
          </tbody>
        </table>
        {showLinkSearch && (
          <div style={{ marginTop: 16 }}>
            <SourceSearchPanel onSelectionChange={setPendingPicks} initialQuery={product.name} />
            <button className="primary" disabled={!pendingPicks.length} onClick={addPickedLinks}>
              Add {pendingPicks.length || ''} selected source{pendingPicks.length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>

      <ReviewsCard
        reviews={reviews}
        ratingAvg={product.rating_avg}
        onAdd={async (review) => {
          await api.addReview(product.id, review);
          load();
        }}
        onDelete={async (reviewId) => {
          await api.deleteReview(reviewId);
          load();
        }}
      />
    </>
  );
}

function ReviewsCard({
  reviews,
  ratingAvg,
  onAdd,
  onDelete,
}: {
  reviews: Review[];
  ratingAvg: number | null;
  onAdd: (review: { rating: number; author?: string; body?: string }) => Promise<void>;
  onDelete: (reviewId: number) => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onAdd({ rating, author: author.trim() || undefined, body: body.trim() || undefined });
      setRating(0);
      setBody('');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (review: Review) => {
    if (!window.confirm('Delete this review?')) return;
    await onDelete(review.id);
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Reviews ({reviews.length})</h3>
        {ratingAvg != null && (
          <>
            <Stars value={ratingAvg} />
            <span className="muted">{ratingAvg} / 5</span>
          </>
        )}
      </div>

      {!IS_STATIC && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StarPicker value={rating} onChange={setRating} />
            <input
              style={{ width: 160 }}
              placeholder="your name (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <textarea
            rows={3}
            placeholder="How do these strings sound and last? (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div>
            <button className="primary small" disabled={!rating || saving} onClick={submit}>
              {saving ? 'Posting…' : 'Post review'}
            </button>
            {!rating && <span className="muted" style={{ marginLeft: 8 }}>pick a star rating first</span>}
          </div>
        </div>
      )}

      {reviews.map((review) => (
        <div key={review.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stars value={review.rating} size={14} />
            <strong>{review.author ?? 'Anonymous'}</strong>
            <span className="muted">{new Date(review.created_at + 'Z').toLocaleDateString()}</span>
            <span style={{ flex: 1 }} />
            {!IS_STATIC && (
              <button className="small" onClick={() => remove(review)}>Delete</button>
            )}
          </div>
          {review.body && <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{review.body}</p>}
        </div>
      ))}
      {!reviews.length && <p className="muted" style={{ margin: 0 }}>No reviews yet.</p>}
    </div>
  );
}
