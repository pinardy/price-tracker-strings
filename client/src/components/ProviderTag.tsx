import { PROVIDER_COLORS } from '../api';

const LABELS: Record<string, string> = {
  fiddlershop: 'Fiddlershop',
  shar: 'Shar',
  thomann: 'Thomann',
  swstrings: 'SW Strings',
  reverb: 'Reverb',
};

export function ProviderTag({ id }: { id: string }) {
  return (
    <span className="provider-tag" style={{ background: PROVIDER_COLORS[id] ?? '#64748b' }}>
      {LABELS[id] ?? id}
    </span>
  );
}
