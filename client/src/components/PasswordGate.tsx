import { ReactNode, useCallback, useEffect, useState } from 'react';
import { api, setAppPassword } from '../api';

/**
 * Gates the whole app behind the shared APP_PASSWORD when the server
 * enforces one. When the server has no password set (local dev), the
 * initial probe succeeds and no prompt ever appears.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'locked'>('checking');
  const [input, setInput] = useState('');
  const [failed, setFailed] = useState(false);

  const probe = useCallback(async () => {
    try {
      await api.providers(); // cheap gated endpoint, no DB hit
      setState('ok');
      setFailed(false);
    } catch (err) {
      if (String(err).startsWith('Error: 401')) setState('locked');
      else setState('ok'); // server down etc. — let the app show its own errors
    }
  }, []);

  useEffect(() => {
    probe();
    const relock = () => setState('locked');
    window.addEventListener('app:unauthorized', relock);
    return () => window.removeEventListener('app:unauthorized', relock);
  }, [probe]);

  if (state === 'ok') return <>{children}</>;
  if (state === 'checking') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppPassword(input);
    setFailed(false);
    try {
      await api.providers();
      setState('ok');
    } catch {
      setFailed(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="card" style={{ width: 320, textAlign: 'center' }} onSubmit={submit}>
        <div style={{ fontSize: 32 }}>🎻</div>
        <h2 style={{ margin: '8px 0 4px' }}>String Price Tracker</h2>
        <p className="muted">Enter the password to continue.</p>
        <input
          type="password"
          style={{ width: '100%', marginBottom: 10 }}
          placeholder="Password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        {failed && <p className="error-text">Wrong password.</p>}
        <button className="primary" style={{ width: '100%' }} type="submit" disabled={!input}>
          Unlock
        </button>
      </form>
    </div>
  );
}
