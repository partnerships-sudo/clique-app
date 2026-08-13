'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@web/providers/session-provider';
import { useCurrentProfile } from '@web/lib/feed';

// ── Icons (defined first so they're available in module-level arrays) ───────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// ── Nav items ────────────────────────────────────────────────────────────────

const LEFT_ITEMS = [
  { href: '/feed',    label: 'Feed',    icon: HomeIcon },
  { href: '/search',  label: 'Discover', icon: SearchIcon },
];

const RIGHT_ITEMS = [
  { href: '/notifications', label: 'Activity', icon: BellIcon },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--card)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      height: 64,
      paddingBottom: 'env(safe-area-inset-bottom)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* Left side: Feed + Discover */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around' }}>
        {LEFT_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 16px',
              color: active ? 'var(--trust)' : 'var(--muted)',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              <item.icon active={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Center: + Log button */}
      <div style={{ flexShrink: 0, padding: '0 8px' }}>
        <button
          onClick={() => router.push('/log')}
          style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--trust)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(108,93,211,0.35)',
            fontSize: 26, lineHeight: 1, fontWeight: 300,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)'; }}
          onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
          aria-label="Log something"
        >
          +
        </button>
      </div>

      {/* Right side: Activity + Profile */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-around' }}>
        {RIGHT_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 16px',
              color: active ? 'var(--trust)' : 'var(--muted)',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              <item.icon active={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Profile */}
        {user ? (
          <ProfileTab />
        ) : (
          <Link href="/login" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '10px 16px',
            color: 'var(--muted)', textDecoration: 'none',
          }}>
            <PersonIcon active={false} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>Sign in</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function ProfileTab() {
  const pathname = usePathname();
  const { data: profile } = useCurrentProfile();
  const href = profile?.username ? `/${profile.username}` : '/settings';
  const active = profile?.username ? pathname === `/${profile.username}` : pathname === '/settings';
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
    : (profile?.username?.[0] ?? '?').toUpperCase();

  return (
    <Link href={href} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 3, padding: '10px 12px',
      color: active ? 'var(--trust)' : 'var(--muted)',
      textDecoration: 'none', transition: 'color 0.15s',
    }}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.username}
          style={{
            width: 24, height: 24, borderRadius: '50%', objectFit: 'cover',
            outline: active ? '2px solid var(--trust)' : '2px solid transparent',
            outlineOffset: 1,
          }}
        />
      ) : (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: active ? 'var(--trust)' : 'var(--border)',
          color: active ? '#fff' : 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
        }}>
          {profile ? initials : <PersonIcon active={active} />}
        </div>
      )}
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: 0.2 }}>
        Profile
      </span>
    </Link>
  );
}

