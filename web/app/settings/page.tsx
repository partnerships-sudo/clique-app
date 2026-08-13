'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import { useQueryClient } from '@tanstack/react-query';
import { RATING_ICON_OPTIONS, type RatingIconStyle } from '@web/components/ui/rating-icons';

const supabase = createClient();

export default function SettingsPage() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [ratingIcon, setRatingIcon] = useState<RatingIconStyle>('stars');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    supabase
      .from('profiles')
      .select('full_name, username, bio, avatar_url, rating_icon')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? '');
          setUsername(data.username ?? '');
          setBio(data.bio ?? '');
          setAvatarUrl(data.avatar_url ?? null);
          setRatingIcon((data.rating_icon as RatingIconStyle) ?? 'stars');
        }
        setLoading(false);
      });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const clean = username.replace('@', '').trim();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), username: clean, bio: bio.trim() })
        .eq('id', user!.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['web-profile', clean] });
      qc.invalidateQueries({ queryKey: ['web-feed'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    setError(null);
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      setAvatarUrl(url);
      qc.invalidateQueries({ queryKey: ['web-profile', username] });
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [showPwSection, setShowPwSection] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwError("Passwords don't match."); return; }
    if (pwNew.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    setPwSaving(true);
    setPwError(null);
    // Re-authenticate with current password first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: pwCurrent,
    });
    if (signInErr) {
      setPwError('Current password is incorrect.');
      setPwSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
    } else {
      setPwSaved(true);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setTimeout(() => { setPwSaved(false); setShowPwSection(false); }, 2500);
    }
  }

  async function handleRatingIcon(value: RatingIconStyle) {
    setRatingIcon(value);
    await supabase.from('profiles').update({ rating_icon: value }).eq('id', user!.id);
    qc.invalidateQueries({ queryKey: ['web-rating-icon', user?.id] });
    qc.invalidateQueries({ queryKey: ['web-current-profile'] });
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 28px', letterSpacing: -0.4 }}>Settings</h1>
        <div style={{ height: 200, background: 'var(--card)', borderRadius: 16, border: '1px solid var(--border)' }} />
      </div>
    );
  }

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : username[0]?.toUpperCase() ?? '?';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 28px', letterSpacing: -0.4 }}>Settings</h1>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadingAvatar}
          style={{
            position: 'relative', background: 'none', border: 'none',
            cursor: uploadingAvatar ? 'not-allowed' : 'pointer', padding: 0, flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              width={72} height={72}
              style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--tlight)', color: 'var(--trust)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 700,
            }}>
              {initials}
            </div>
          )}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, opacity: uploadingAvatar ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={(e) => !uploadingAvatar && ((e.currentTarget as HTMLDivElement).style.opacity = '1')}
            onMouseLeave={(e) => !uploadingAvatar && ((e.currentTarget as HTMLDivElement).style.opacity = '0')}
          >
            {uploadingAvatar ? '⏳' : '📷'}
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Profile photo</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Click to change</div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" />
        <Field label="Username" value={username} onChange={setUsername} placeholder="username" prefix="@" />
        <div>
          <label style={labelStyle}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself"
            rows={3}
            maxLength={200}
            style={{
              width: '100%', padding: '11px 14px',
              border: '1px solid var(--border)', borderRadius: 10,
              fontSize: 14, background: 'var(--card)', color: 'var(--ink)',
              fontFamily: 'inherit', outline: 'none', resize: 'vertical',
              boxSizing: 'border-box', lineHeight: 1.5,
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 3 }}>{bio.length}/200</div>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0, padding: '8px 12px', background: 'rgba(232,79,79,0.08)', borderRadius: 8 }}>
            {error}
          </p>
        )}

        {saved && (
          <p style={{ fontSize: 13, color: '#10B981', margin: 0, padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
            ✓ Saved
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            background: 'var(--trust)', color: '#fff',
            border: 'none', borderRadius: 12, padding: '13px 0',
            fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1, fontFamily: 'inherit', letterSpacing: 0.2,
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>

      {/* Rating icon picker */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Rating style
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.4 }}>
          Choose the icon used for ratings across the app
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {RATING_ICON_OPTIONS.map((opt) => {
            const active = ratingIcon === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRatingIcon(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, padding: '14px 8px',
                  borderRadius: 14,
                  border: active ? '2px solid var(--trust)' : '1.5px solid var(--border)',
                  background: active ? 'var(--tlight)' : 'var(--card)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {/* Preview: 3 filled icons */}
                <div style={{ display: 'flex', gap: 2, fontSize: 18, lineHeight: 1 }}>
                  {opt.value === 'stars'
                    ? <><span style={{ color: '#F4A340' }}>★</span><span style={{ color: '#F4A340' }}>★</span><span style={{ color: '#D0D0D0' }}>★</span></>
                    : <>{opt.emoji}{opt.emoji}<span style={{ opacity: 0.28 }}>{opt.emoji}</span></>
                  }
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: active ? 'var(--trust)' : 'var(--ink)',
                }}>
                  {opt.label}
                </span>
                {active && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--trust)' }}>✓ Selected</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '32px 0' }} />

      {/* Account info */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Account</div>
        <div style={{ fontSize: 14, color: 'var(--ink)', opacity: 0.7 }}>{user?.email}</div>
      </div>

      {/* Change password */}
      <button
        onClick={() => { setShowPwSection(!showPwSection); setPwError(null); setPwSaved(false); }}
        style={{
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 16px', width: '100%',
          fontSize: 14, fontWeight: 600, color: 'var(--ink)',
          cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>Change password</span>
        <span style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>{showPwSection ? '−' : '+'}</span>
      </button>

      {showPwSection && (
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <PwField label="Current password" value={pwCurrent} onChange={setPwCurrent} />
          <PwField label="New password" value={pwNew} onChange={setPwNew} />
          <PwField label="Confirm new password" value={pwConfirm} onChange={setPwConfirm} />

          {pwError && (
            <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0, padding: '8px 12px', background: 'rgba(232,79,79,0.08)', borderRadius: 8 }}>
              {pwError}
            </p>
          )}
          {pwSaved && (
            <p style={{ fontSize: 13, color: '#10B981', margin: 0, padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: 8 }}>
              ✓ Password updated
            </p>
          )}

          <button
            type="submit"
            disabled={pwSaving}
            style={{
              background: 'var(--trust)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '12px 0',
              fontSize: 14, fontWeight: 700, cursor: pwSaving ? 'not-allowed' : 'pointer',
              opacity: pwSaving ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >
            {pwSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}

      {/* More settings links */}
      <div style={{ height: 1, background: 'var(--border)', margin: '24px 0 20px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
        {[
          { href: '/settings/account',        emoji: '👤', label: 'Account info',             sub: 'Email, username, password, delete account' },
          { href: '/settings/privacy',        emoji: '🔒', label: 'Privacy settings',        sub: 'Visibility, online status, read receipts' },
          { href: '/settings/close-friends',  emoji: '⭐', label: 'Close friends',           sub: 'Manage who sees your close friends posts' },
          { href: '/settings/blocked',        emoji: '🚫', label: 'Blocked & muted accounts', sub: null },
          { href: '/settings/notifications',  emoji: '🔔', label: 'Push notification settings', sub: null },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--card)',
              cursor: 'pointer', transition: 'background 0.12s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tlight)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card)')}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'var(--tlight)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }}>
                {item.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{item.sub}</div>}
              </div>
              <span style={{ fontSize: 18, color: 'var(--muted)' }}>›</span>
            </div>
          </Link>
        ))}
      </div>

      <button
        onClick={handleSignOut}
        style={{
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 0', width: '100%',
          fontSize: 14, fontWeight: 600, color: 'var(--danger)',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
          placeholder="••••••••"
          required
          style={{
            width: '100%', padding: '11px 42px 11px 14px',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
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
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 6,
  letterSpacing: 0.5, textTransform: 'uppercase',
};

function Field({ label, value, onChange, placeholder, prefix }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; prefix?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix && (
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 15, color: 'var(--muted)', pointerEvents: 'none',
          }}>
            {prefix}
          </span>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', padding: `11px 14px 11px ${prefix ? '26px' : '14px'}`,
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>
    </div>
  );
}
