import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertRule, api, formatPrice } from '../api';

interface Props {
  /** When set, the manager is scoped to one product and hides the product picker. */
  productId?: number;
  /** Called after any create/update/delete so parents can refresh. */
  onChanged?: () => void;
}

export function AlertRulesManager({ productId, onChanged }: Props) {
  const [rules, setRules] = useState<AlertRule[] | null>(null);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [newProductId, setNewProductId] = useState<string>(productId ? String(productId) : '');
  const [newThreshold, setNewThreshold] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .alertRules()
      .then((all) => setRules(productId ? all.filter((r) => r.product_id === productId) : all))
      .catch((err) => setError(String(err)));
    if (!productId) {
      api.products().then((ps) => setProducts(ps.map((p) => ({ id: p.id, name: p.name })))).catch(() => {});
    }
  }, [productId]);

  useEffect(load, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const create = async () => {
    const threshold = parseFloat(newThreshold);
    const targetProduct = productId ?? parseInt(newProductId, 10);
    if (!Number.isFinite(threshold) || threshold <= 0 || !targetProduct) return;
    setError(null);
    try {
      await api.createAlertRule(targetProduct, threshold);
      setNewThreshold('');
      if (!productId) setNewProductId('');
      changed();
    } catch (err) {
      setError(String(err));
    }
  };

  const saveEdit = async (rule: AlertRule) => {
    const threshold = parseFloat(editValue);
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    setError(null);
    try {
      await api.updateAlertRule(rule.id, threshold);
      setEditingId(null);
      changed();
    } catch (err) {
      setError(String(err));
    }
  };

  const remove = async (rule: AlertRule) => {
    if (!window.confirm(`Delete the S$${rule.threshold_sgd} alert for "${rule.product_name}"?`)) return;
    await api.deleteAlertRule(rule.id);
    changed();
  };

  if (!rules) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 12 }}>
        {!productId && (
          <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
            <option value="">Choose product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <label className="muted">
          Alert at or below S$
          <input
            type="number"
            min="0"
            step="0.01"
            className="filter-price"
            placeholder="e.g. 80"
            value={newThreshold}
            onChange={(e) => setNewThreshold(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
        </label>
        <button
          className="primary small"
          onClick={create}
          disabled={!newThreshold || (!productId && !newProductId)}
        >
          Add alert
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!rules.length && <p className="muted">No saved alerts yet.</p>}
      <table className="responsive-table">
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              {!productId && (
                <td data-label="Product">
                  <Link to={`/products/${rule.product_id}`}><strong>{rule.product_name}</strong></Link>{' '}
                  <span className="instrument-pill">{rule.instrument}</span>
                </td>
              )}
              <td data-label="Alert threshold">
                {editingId === rule.id ? (
                  <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    S$
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="filter-price"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(rule)}
                      autoFocus
                    />
                    <button className="primary small" onClick={() => saveEdit(rule)}>Save</button>
                    <button className="small" onClick={() => setEditingId(null)}>Cancel</button>
                  </span>
                ) : (
                  <span className="price-chip">≤ {formatPrice(rule.threshold_sgd, 'SGD')}</span>
                )}
              </td>
              <td data-label="Current lowest">
                {rule.lowest_price_sgd != null ? (
                  <span
                    className="price-chip"
                    style={
                      rule.lowest_price_sgd <= rule.threshold_sgd
                        ? { background: '#dcfce7', color: '#166534' }
                        : undefined
                    }
                  >
                    {formatPrice(rule.lowest_price_sgd, 'SGD')}
                  </span>
                ) : (
                  <span className="muted">no data</span>
                )}
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {editingId !== rule.id && (
                  <button
                    className="small"
                    onClick={() => {
                      setEditingId(rule.id);
                      setEditValue(String(rule.threshold_sgd));
                    }}
                  >
                    Edit
                  </button>
                )}{' '}
                <button className="small" onClick={() => remove(rule)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
