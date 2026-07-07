/** Read-only star row; `value` may be fractional (rounded to nearest star). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const filled = Math.round(value);
  return (
    <span style={{ color: 'var(--amber)', fontSize: size, letterSpacing: 1 }} title={`${value} / 5`}>
      {'★'.repeat(filled)}
      <span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - filled)}</span>
    </span>
  );
}

/** Clickable star picker for the review form. */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span role="radiogroup" aria-label="rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 2px',
            fontSize: 22,
            lineHeight: 1,
            color: star <= value ? 'var(--amber)' : 'var(--border)',
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
}
