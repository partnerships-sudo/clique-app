'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

// ── Reusable primitives ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', letterSpacing: 0.6,
  textTransform: 'uppercase', marginBottom: 6,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.8, textTransform: 'uppercase', margin: '28px 0 10px' }}>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
    </div>
  );
}

function TextInput({
  label, value, onChange, type = 'text', placeholder, prefix, hint, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; prefix?: string; hint?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)', pointerEvents: 'none' }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: `11px 14px 11px ${prefix ? '28px' : '14px'}`,
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 14, background: 'var(--paper)', color: 'var(--ink)',
            fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

function PasswordInput({ label, value, onChange, placeholder, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          autoComplete={autoComplete}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 44px 11px 14px',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 14, background: 'var(--paper)', color: 'var(--ink)',
            fontFamily: 'inherit', outline: 'none',
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
            fontSize: 15, padding: 0, color: 'var(--muted)',
          }}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, danger = false }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: danger ? '#E84F4F' : 'var(--trust)',
        color: '#fff', border: 'none', borderRadius: 12,
        padding: '12px 0', fontSize: 14, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, fontFamily: 'inherit',
        width: '100%', transition: 'opacity 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function Toast({ text, color = '#10B981' }: { text: string; color?: string }) {
  return (
    <div style={{
      padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: `${color}18`, color, lineHeight: 1.4,
    }}>
      {text}
    </div>
  );
}

// ── Email section ─────────────────────────────────────────────────────────────

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    const trimmed = email.trim();
    if (!trimmed || trimmed === currentEmail) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
    } else {
      setMsg({ text: 'Confirmation link sent. Check your new inbox to complete the change.', ok: true });
    }
  }

  const unchanged = email.trim() === currentEmail;

  return (
    <Card>
      <TextInput
        label="Email address"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        hint="You'll receive a confirmation link at your new address."
      />
      {msg && <Toast text={msg.text} color={msg.ok ? '#10B981' : '#E84F4F'} />}
      <PrimaryBtn onClick={save} disabled={unchanged || saving}>
        {saving ? 'Sending link…' : 'Update email'}
      </PrimaryBtn>
    </Card>
  );
}

// ── Username section ──────────────────────────────────────────────────────────

function UsernameSection({ currentUsername, userId }: { currentUsername: string; userId: string }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(currentUsername);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    const clean = username.replace('@', '').trim().toLowerCase();
    if (!clean || clean === currentUsername) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', userId);
    setSaving(false);
    if (error) {
      setMsg({ text: error.message.includes('unique') ? 'That username is already taken.' : error.message, ok: false });
    } else {
      setMsg({ text: `Username updated to @${clean}`, ok: true });
      qc.invalidateQueries({ queryKey: ['web-profile', clean] });
      qc.invalidateQueries({ queryKey: ['web-current-profile'] });
    }
  }

  const clean = username.replace('@', '').trim().toLowerCase();
  const unchanged = clean === currentUsername;

  return (
    <Card>
      <TextInput
        label="Username"
        value={username}
        onChange={setUsername}
        placeholder="yourhandle"
        prefix="@"
        autoComplete="username"
      />
      {msg && <Toast text={msg.text} color={msg.ok ? '#10B981' : '#E84F4F'} />}
      <PrimaryBtn onClick={save} disabled={unchanged || saving || !clean}>
        {saving ? 'Saving…' : 'Update username'}
      </PrimaryBtn>
    </Card>
  );
}

// ── Password section ──────────────────────────────────────────────────────────

function PasswordSection({ userEmail }: { userEmail: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save() {
    setMsg(null);
    if (!current || !next || !confirm) { setMsg({ text: 'Please fill in all three fields.', ok: false }); return; }
    if (next.length < 8) { setMsg({ text: 'New password must be at least 8 characters.', ok: false }); return; }
    if (next !== confirm) { setMsg({ text: "New password and confirmation don't match.", ok: false }); return; }
    if (next === current) { setMsg({ text: 'New password must be different from your current one.', ok: false }); return; }
    setSaving(true);
    // Re-authenticate to verify current password
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: current });
    if (authErr) { setMsg({ text: 'Current password is incorrect.', ok: false }); setSaving(false); return; }
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) {
      setMsg({ text: error.message, ok: false });
    } else {
      setCurrent(''); setNext(''); setConfirm('');
      setMsg({ text: 'Password updated successfully.', ok: true });
    }
  }

  return (
    <Card>
      <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordInput label="New password" value={next} onChange={setNext} placeholder="At least 8 characters" autoComplete="new-password" />
      <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      {msg && <Toast text={msg.text} color={msg.ok ? '#10B981' : '#E84F4F'} />}
      <PrimaryBtn onClick={save} disabled={!current || !next || !confirm || saving}>
        {saving ? 'Updating…' : 'Change password'}
      </PrimaryBtn>
    </Card>
  );
}

// ── Delete account section ────────────────────────────────────────────────────

function DeleteSection({ username, userId }: { username: string; userId: string }) {
  const { signOut } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const expected = `@${username}`;
  const confirmed = confirmText.trim() === expected;

  async function handleDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      qc.clear();
      await signOut();
      router.replace('/login');
    } catch (e: any) {
      setErr(e.message ?? 'Could not delete account. Please try again or contact support.');
      setDeleting(false);
    }
  }

  return (
    <Card>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
        Deleting your account is permanent and cannot be undone. Your profile, posts, ratings, library, and all connections will be removed immediately.
      </p>

      {!open ? (
        <PrimaryBtn danger onClick={() => setOpen(true)}>
          Delete my account
        </PrimaryBtn>
      ) : (
        <div style={{
          border: '1.5px solid #E84F4F', borderRadius: 12, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
          background: 'rgba(232,79,79,0.04)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#E84F4F' }}>Confirm deletion</div>
          <p style={{ fontSize: 13, color: 'var(--ink)', margin: 0, lineHeight: 1.55 }}>
            Type <strong>{expected}</strong> below to confirm you want to permanently delete your account.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
            autoComplete="off"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 14px', border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 14, background: 'var(--paper)', color: 'var(--ink)',
              fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#E84F4F'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          {err && <Toast text={err} color="#E84F4F" />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmText(''); setErr(null); }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                border: '1px solid var(--border)', background: 'var(--paper)',
                color: 'var(--muted)', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmed || deleting}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                border: 'none', background: '#E84F4F',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: !confirmed || deleting ? 'not-allowed' : 'pointer',
                opacity: !confirmed || deleting ? 0.45 : 1,
                fontFamily: 'inherit', transition: 'opacity 0.15s',
              }}
            >
              {deleting ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountInfoPage() {
  const { user } = useSession();
  const [profile, setProfile] = useState<{ username: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [user?.id]);

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
        <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to manage your account.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--trust)', fontWeight: 700, textDecoration: 'none' }}>
          ← Settings
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: -0.4 }}>
        Account info
      </h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 4px', lineHeight: 1.5 }}>
        Signed in as <strong style={{ color: 'var(--ink)' }}>{user.email}</strong>
      </p>

      <SectionLabel>Email address</SectionLabel>
      <EmailSection currentEmail={user.email ?? ''} />

      <SectionLabel>Username</SectionLabel>
      {profile
        ? <UsernameSection currentUsername={profile.username} userId={user.id} />
        : <div style={{ height: 80, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }} />}

      <SectionLabel>Change password</SectionLabel>
      <PasswordSection userEmail={user.email ?? ''} />

      <SectionLabel>Danger zone</SectionLabel>
      {profile
        ? <DeleteSection username={profile.username} userId={user.id} />
        : <div style={{ height: 120, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16 }} />}
    </div>
  );
}
