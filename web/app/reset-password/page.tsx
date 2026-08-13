'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Supabase puts the recovery token in the URL hash — we must wait for
  // onAuthStateChange to fire with event=PASSWORD_RECOVERY before the
  // updateUser call will work.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.push('/feed'), 2500);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Image src="/logo-icon.png" alt="Clique" width={56} height={56} style={{ borderRadius: 14, marginBottom: 12 }} />
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>
            {done ? 'Password updated!' : 'Set a new password'}
          </h1>
          {!done && (
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: '6px 0 0' }}>
              Choose something strong and memorable.
            </p>
          )}
        </div>

        {done ? (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 14, padding: '20px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
              Your password has been changed. Taking you to your feed…
            </div>
          </div>
        ) : !ready ? (
          <div style={{
            background: 'rgba(232,79,79,0.06)', border: '1px solid rgba(232,79,79,0.2)',
            borderRadius: 14, padding: '20px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔗</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Waiting for reset link…</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              Click the link in your email to land here. If you came directly, request a new reset link.
            </div>
            <a
              href="/forgot-password"
              style={{
                display: 'inline-block', marginTop: 16,
                fontSize: 13, color: 'var(--trust)', fontWeight: 600, textDecoration: 'none',
              }}
            >
              Request a new link →
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
            />
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Same again"
            />

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
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: '100%', padding: '11px 42px 11px 14px',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, padding: 0, color: 'var(--muted)',
          }}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}
