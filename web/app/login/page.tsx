'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from '@web/providers/session-provider';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) { setError(error); setLoading(false); return; }
    } else {
      const { error } = await signUp({ email, password, fullName, username });
      if (error) { setError(error); setLoading(false); return; }
    }
    router.push('/feed');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Image src="/logo-icon.png" alt="Clique" width={56} height={56} style={{ borderRadius: 14, marginBottom: 12 }} />
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.5 }}>Clique</h1>
          <p style={{ fontSize: 15, color: 'var(--muted)', margin: '6px 0 0' }}>Watch, read, play — together</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: 'var(--card)', borderRadius: 12, padding: 4, marginBottom: 28, border: '1px solid var(--border)' }}>
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer',
                borderRadius: 9, fontSize: 14, fontWeight: 700,
                background: mode === m ? 'var(--trust)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <>
              <Field label="Full name" type="text" value={fullName} onChange={setFullName} placeholder="Your name" required />
              <Field label="Username" type="text" value={username} onChange={setUsername} placeholder="username" required />
            </>
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" required />
          <div>
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />
            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <Link href="/forgot-password" style={{ fontSize: 12, color: 'var(--trust)', textDecoration: 'none', fontWeight: 600 }}>
                  Forgot password?
                </Link>
              </div>
            )}
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
              opacity: loading ? 0.6 : 1, marginTop: 4,
              fontFamily: 'inherit', letterSpacing: 0.2,
            }}
          >
            {loading ? '...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, required }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        style={{
          width: '100%', padding: '11px 14px', border: '1px solid var(--border)',
          borderRadius: 10, fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
          fontFamily: 'inherit', outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  );
}
