'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useSession } from '@web/providers/session-provider';
import { useTheme } from '@web/providers/theme-provider';

export function Nav() {
  const { user, signOut } = useSession();
  const { resolved, setTheme } = useTheme();
  const pathname = usePathname();

  function toggleTheme() {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      height: 56,
      display: 'flex', alignItems: 'center',
      padding: '0 20px',
      gap: 12,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Image src="/logo-icon.png" alt="Clique" width={28} height={28} style={{ borderRadius: 6 }} />
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--ink)', letterSpacing: -0.3 }}>Clique</span>
      </Link>

      {/* Nav links */}
      {user && (
        <div style={{ display: 'flex', gap: 4 }}>
          <NavLink href="/feed" active={pathname === '/feed'}>Feed</NavLink>
          <NavLink href="/search" active={pathname.startsWith('/search')}>Discover</NavLink>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Log button */}
      {user && (
        <Link
          href="/log"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--trust)', color: '#fff',
            padding: '7px 16px', borderRadius: 20,
            fontSize: 14, fontWeight: 700, letterSpacing: 0.2,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: -1 }}>+</span> Log
        </Link>
      )}

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, padding: 4,
          color: 'var(--muted)', flexShrink: 0,
        }}
      >
        {resolved === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Avatar / sign in */}
      {user ? (
        <Link
          href="/settings"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--tlight)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'var(--trust)',
            flexShrink: 0,
          }}
        >
          {(user.email?.[0] ?? '?').toUpperCase()}
        </Link>
      ) : (
        <Link
          href="/login"
          style={{
            background: 'var(--trust)', color: '#fff',
            padding: '7px 16px', borderRadius: 20,
            fontSize: 14, fontWeight: 700, letterSpacing: 0.2,
          }}
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: '6px 12px', borderRadius: 8,
        fontSize: 14, fontWeight: active ? 700 : 500,
        color: active ? 'var(--trust)' : 'var(--muted)',
        background: active ? 'var(--tlight)' : 'transparent',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </Link>
  );
}
