import { useState } from 'react';
import loginArt from './assets/login-illustration.png';
import ubLogo from './assets/ub-logo.jpg';
import { supabase } from './supabase';
import './pages/loginPage.css';

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
    <div className="login-page">
      {/* LEFT: login form */}
      <div className="login-page__left">
        <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>
          <img
            src={ubLogo}
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
        </div>
      </div>

      {/* RIGHT: brand panel */}
      <div className="login-art-panel">
        <div className="login-art-panel__card">
          <img src={loginArt} className="login-art-panel__img" alt="" />
        </div>
      </div>
    </div>
  );
}
