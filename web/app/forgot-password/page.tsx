'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://clique.app';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Image src="/logo-icon.png" alt="Clique" width={56} height={56} style={{ borderRadius: 14, marginBottom: 12 }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>Reset your password</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Enter your email and we'll send you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 14, padding: '20px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Check your inbox</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              We sent a password reset link to <strong style={{ color: 'var(--ink)' }}>{email}</strong>.
              Check your spam folder if you don't see it within a minute.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoFocus
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0, padding: '8px 12px', background: 'rgba(232,79,79,0.08)', borderRadius: 8 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--trust)', color: '#fff',
                border: 'none', borderRadius: 12, padding: '14px 0',
                fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, fontFamily: 'inherit', letterSpacing: 0.2,
              }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--trust)', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 6,
  letterSpacing: 0.5, textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1px solid var(--border)', borderRadius: 10,
  fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
