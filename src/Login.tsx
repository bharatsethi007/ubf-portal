import { useState } from 'react';
import { supabase } from './supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError('Invalid email or password');
      return;
    }
    // Session is set; your app's auth listener / route guard will redirect.
    // If you redirect manually elsewhere, do it here instead.
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* LEFT: login form */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
        }}
      >
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
          <img
            src="/src/assets/ub-logo.jpg"
            alt="UB Freight"
            style={{ height: 44, marginBottom: 28 }}
          />
          <h1 style={{ fontSize: 24, fontWeight: 500, color: '#0A2472', margin: '0 0 24px' }}>
            Login to your account
          </h1>

          <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 6 }}>
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pw')?.focus()}
            style={{
              width: '100%', height: 44, padding: '0 12px', marginBottom: 16,
              border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, boxSizing: 'border-box',
            }}
          />

          <label style={{ display: 'block', fontSize: 13, color: '#334155', marginBottom: 6 }}>
            Password
          </label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && password && signIn()}
            style={{
              width: '100%', height: 44, padding: '0 12px', marginBottom: 8,
              border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15, boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>
          )}

          <button
            type="button"
            onClick={signIn}
            disabled={busy || !email || !password}
            style={{
              width: '100%', height: 44, marginTop: 8, border: 'none', borderRadius: 8,
              background: busy || !email || !password ? '#94a3b8' : '#0A2472',
              color: '#fff', fontSize: 15, fontWeight: 500,
              cursor: busy || !email || !password ? 'default' : 'pointer',
            }}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 24 }}>UB Freight Ltd</div>
        </div>
      </div>

      {/* RIGHT: brand panel */}
      <div
        style={{
          flex: 1,
          background: '#0A2472',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          padding: 48,
          position: 'relative',
          overflow: 'hidden',
        }}
        className="login-brand-panel"
      >
        <h2 style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.3, maxWidth: 360 }}>
          Moving freight across NZ, Australia &amp; the Pacific
        </h2>
      </div>
    </div>
  );
}
