import React from 'react';

// ── Layout helpers ────────────────────────────────────────────────────────────
export function Row({ children, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      {children}
    </div>
  );
}

export function Spacer() {
  return <div style={{ flex: 1 }} />;
}

export function Grid2({ children, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 10, ...style,
    }}>
      {children}
    </div>
  );
}

export function Grid3({ children, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 10, ...style,
    }}>
      {children}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ title, children, style }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #f0ddd8',
      padding: '16px 18px',
      marginBottom: 16,
      ...style,
    }}>
      {title && (
        <div style={{
          fontWeight: 'bold', fontSize: 13, letterSpacing: 1,
          textTransform: 'uppercase', color: '#b5838d',
          marginBottom: 12,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
      textTransform: 'uppercase', color: '#b5838d', marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

export function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 7,
          border: '1.5px solid #e8ddd8', fontSize: 14,
          fontFamily: 'Georgia,serif', outline: 'none',
        }}
      />
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 7,
          border: '1.5px solid #e8ddd8', fontSize: 14,
          fontFamily: 'Georgia,serif', background: '#fff', outline: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, disabled, small, ghost, danger, large }) {
  const base = {
    border: 'none', borderRadius: 7, fontWeight: 'bold',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'opacity .15s',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'Georgia,serif',
    padding: large ? '10px 22px' : small ? '5px 12px' : '7px 16px',
    fontSize: large ? 15 : small ? 12 : 13,
  };

  let colors = { background: '#c8956c', color: '#fff' };
  if (ghost)  colors = { background: 'transparent', color: '#c8956c', border: '1.5px solid #c8956c' };
  if (danger) colors = { background: '#ff5252', color: '#fff' };

  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...colors }}>
      {children}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
export function Stat({ label, value, warn }) {
  return (
    <div style={{
      background: warn ? '#fff3e0' : '#fdf6f3',
      borderRadius: 8, padding: '7px 14px', minWidth: 80,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: warn ? '#e65100' : '#c8956c' }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#bbb', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ children }) {
  return (
    <div style={{
      textAlign: 'center', color: '#ccc', padding: '30px 20px',
      fontSize: 13, fontStyle: 'italic',
    }}>
      {children}
    </div>
  );
}

// ── Mini inline button (used inside room cards) ───────────────────────────────
export function miniBtn(bg, color) {
  return {
    background: bg, color, border: 'none', borderRadius: 5,
    padding: '3px 9px', fontSize: 11, fontWeight: 'bold',
    cursor: 'pointer', fontFamily: 'Georgia,serif', flexShrink: 0,
  };
}

// ── ClearAll (confirm-before-delete) ─────────────────────────────────────────
export function ClearAll({ onClear, label, color }) {
  const [confirming, setConfirming] = React.useState(false);
  if (confirming) {
    return (
      <Row style={{ gap: 6 }}>
        <span style={{ fontSize: 11, color: '#e65100' }}>Clear {label}?</span>
        <button
          onClick={() => { onClear(); setConfirming(false); }}
          style={miniBtn('#ff5252', '#fff')}
        >Yes</button>
        <button onClick={() => setConfirming(false)} style={miniBtn('#eee', '#666')}>No</button>
      </Row>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        background: 'none', border: 'none', color: color || '#b5838d',
        fontSize: 11, cursor: 'pointer', textDecoration: 'underline',
        fontFamily: 'Georgia,serif',
      }}
    >
      Clear {label}
    </button>
  );
}

// ── Modal dialogs (Alert + Confirm) ──────────────────────────────────────────
export function ConfirmDialog({ message, onOk, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px 24px 18px',
        maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
      }}>
        <div style={{ fontSize: 14, color: '#333', marginBottom: 20, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <Row style={{ justifyContent: 'flex-end', gap: 10 }}>
          <Btn ghost small onClick={onCancel}>Cancel</Btn>
          <Btn small onClick={onOk}>Confirm</Btn>
        </Row>
      </div>
    </div>
  );
}

export function AlertDialog({ message, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '24px 24px 18px',
        maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
      }}>
        <div style={{ fontSize: 14, color: '#333', marginBottom: 20, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <Row style={{ justifyContent: 'flex-end' }}>
          <Btn small onClick={onClose}>OK</Btn>
        </Row>
      </div>
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f8ede8 0%,#fdf6f3 100%)',
      gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>🏨</div>
      <div style={{ fontSize: 16, color: '#c8956c', fontFamily: 'Georgia,serif' }}>
        Loading…
      </div>
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────────────────
export function ErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#f8ede8 0%,#fdf6f3 100%)',
      gap: 16, padding: 24,
    }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontSize: 16, color: '#e65100', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
        {message}
      </div>
      <div style={{ fontSize: 12, color: '#aaa', maxWidth: 400, textAlign: 'center' }}>
        Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly,
        then refresh the page.
      </div>
    </div>
  );
}
