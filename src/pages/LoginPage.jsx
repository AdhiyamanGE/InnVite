import React, { useState } from 'react';
import { login, register } from '../lib/auth.js';
import { logAction } from '../lib/audit.js';

const GRAD = 'linear-gradient(135deg, #c8956c 0%, #b5838d 50%, #6d8b74 100%)';

export default function LoginPage({ onSuccess }) {
  const [mode,     setMode]     = useState('login'); // 'login' | 'register'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    if (mode === 'register' && !name.trim()) { setError('Display name is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    if (mode === 'login') {
      const { data, error: err } = await login(email, password);
      if (err) { setError(err.message || 'Login failed.'); setLoading(false); return; }
      onSuccess(data.user);
    } else {
      const { data, error: err } = await register(email, password, name);
      if (err) { setError(err.message || 'Registration failed.'); setLoading(false); return; }
      // Log registration (userId available after signup)
      if (data?.user?.id) {
        logAction({ userId: data.user.id, actionType: 'user_registered',
          description: `New user registered: ${name || email}` });
      }
      onSuccess(data.user);
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: GRAD,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: '36px 32px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>🏨</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', fontFamily: 'Georgia,serif', color: '#c8956c' }}>
            InnVite
          </div>
          <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#ffeaea', border: '1px solid #ffaaaa',
            borderRadius: 8, padding: '10px 14px', marginBottom: 18,
            fontSize: 13, color: '#c00',
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <Field label="Display Name">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name (shown to other users)"
                style={inputStyle} />
            </Field>
          )}
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com" style={inputStyle} autoComplete="email" />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
              style={inputStyle} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>

          <button type="submit" disabled={loading} style={{
            background: GRAD, color: '#fff', border: 'none',
            borderRadius: 10, padding: '12px', fontFamily: 'Georgia,serif',
            fontSize: 15, fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, marginTop: 4,
          }}>
            {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#aaa' }}>
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <button onClick={() => { setMode('register'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#c8956c', cursor: 'pointer', fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 'bold', padding: 0 }}>
                Register
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#c8956c', cursor: 'pointer', fontFamily: 'Georgia,serif', fontSize: 13, fontWeight: 'bold', padding: 0 }}>
                Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase', color: '#b5838d', marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 13px', borderRadius: 8,
  border: '1.5px solid #e8ddd8', fontSize: 14,
  fontFamily: 'Georgia,serif', outline: 'none', boxSizing: 'border-box',
};
