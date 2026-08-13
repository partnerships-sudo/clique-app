'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from '@web/providers/session-provider';
import { useTheme } from '@web/providers/theme-provider';
import { useLogModal } from '@web/providers/log-modal-provider';
import { useCurrentProfile } from '@web/lib/feed';

const NAV_ITEMS = [
  { href: '/feed',          label: 'Feed',          icon: '🏠' },
  { href: '/search',        label: 'Discover',      icon: '🔍' },
  { href: '/library',       label: 'Library',       icon: '📚' },
  { href: '/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/discussions',   label: 'Discussions',   icon: '💬' },
  { href: '/friends',        label: 'Friends',       icon: '👥' },
  { href: '/mytaste',        label: 'MyTaste',       icon: '🎯' },
  { href: '/analytics',      label: 'Analytics',     icon: '📊' },
  { href: '/messages',      label: 'Messages',      icon: '✉️' },
  { href: '/news',          label: 'News',          icon: '📰' },
  { href: '/lounges',       label: 'Lounges',       icon: '🎭' },
];

export function Sidebar() {
  const { user } = useSession();
  const { resolved, setTheme } = useTheme();
  const pathname = usePathname();
  const { open: openLogModal } = useLogModal();
  const { data: profile } = useCurrentProfile();

  const displayName = profile?.full_name ?? profile?.username ?? user?.email?.split('@')[0] ?? '?';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <aside style={{
      top: 0, left: 0, bottom: 0,
      width: 220,
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      background: 'var(--card)',
      padding: '0 12px',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 12px 24px' }}>
        <Image src="/logo-icon.png" alt="Clique" width={30} height={30} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--ink)', letterSpacing: -0.5 }}>Clique</span>
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/feed' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', borderRadius: 10,
                fontSize: 15, fontWeight: active ? 700 : 500,
                color: active ? 'var(--trust)' : 'var(--ink)',
                background: active ? 'var(--tlight)' : 'transparent',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {/* Log CTA */}
        {user && (
          <button
            onClick={openLogModal}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 16,
              background: 'var(--trust)', color: '#fff',
              padding: '12px 0', borderRadius: 12,
              fontSize: 15, fontWeight: 700, letterSpacing: 0.1,
              border: 'none', cursor: 'pointer', width: '100%',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Log
          </button>
        )}
      </nav>

      {/* Bottom: theme + profile */}
      <div style={{ paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: 'var(--muted)', fontFamily: 'inherit', fontWeight: 500,
            width: '100%', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>
            {resolved === 'dark' ? '☀️' : '🌙'}
          </span>
          {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        {user ? (
          <Link
            href={profile?.username ? `/${profile.username}` : '/settings'}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tlight)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                width={34}
                height={34}
                style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--tlight)', color: 'var(--trust)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {profile?.username ? `@${profile.username}` : 'Settings'}
              </div>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--trust)', color: '#fff',
              padding: '11px 0', borderRadius: 12,
              fontSize: 14, fontWeight: 700,
            }}
          >
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
