import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HistoryPoint, PROVIDER_COLORS } from '../api';

interface Props {
  history: HistoryPoint[];
  /** provider_id per link_id, marketplace links drawn dashed */
  marketplaceLinkIds: Set<number>;
}

/**
 * One line per link (source). Points are grouped per day per link; when a
 * product has sources in several currencies the series remain readable
 * because each line is a single source/currency.
 */
export function PriceHistoryChart({ history, marketplaceLinkIds }: Props) {
  const { data, series } = useMemo(() => {
    const seriesKeys = new Map<number, string>(); // link_id -> "provider (CUR)"
    for (const point of history) {
      if (!seriesKeys.has(point.link_id)) {
        seriesKeys.set(point.link_id, `${point.provider_id} (${point.currency})`);
      }
    }
    const byDay = new Map<string, Record<string, number | string>>();
    for (const point of history) {
      const day = point.scraped_at.slice(0, 10);
      const row = byDay.get(day) ?? { day };
      row[seriesKeys.get(point.link_id)!] = point.price;
      byDay.set(day, row);
    }
    return {
      data: [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day))),
      series: [...seriesKeys.entries()].map(([linkId, key]) => ({
        key,
        color: PROVIDER_COLORS[key.split(' ')[0]] ?? '#64748b',
        dashed: marketplaceLinkIds.has(linkId),
      })),
    };
  }, [history, marketplaceLinkIds]);

  if (!history.length) {
    return <p className="muted">No price history yet — it accumulates with each daily fetch.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" fontSize={12} />
        <YAxis fontSize={12} domain={['auto', 'auto']} tickFormatter={(v) => String(v)} />
        <Tooltip />
        <Legend />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '6 4' : undefined}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
