'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Nav } from './nav';
import { RightPanel } from './right-panel';
import { MobileBottomNav } from './mobile-bottom-nav';

const RIGHT_PANEL_PAGES = ['/feed', '/search', '/library'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showRightPanel = RIGHT_PANEL_PAGES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  return (
    <>
      {/* Desktop sidebar */}
      <div className="desktop-sidebar">
        <Sidebar />
      </div>
      <style>{`.desktop-sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 220px; z-index: 100; }`}</style>

      {/* Mobile top nav (hidden — replaced by bottom nav) */}
      <div className="mobile-nav" style={{ display: 'none' }}>
        <Nav />
      </div>

      {/* Mobile bottom nav */}
      <div className="mobile-bottom-nav">
        <MobileBottomNav />
      </div>

      {/* Page wrapper */}
      <div className="page-wrapper">
        <main className="page-main">
          {children}
        </main>

        {showRightPanel && (
          <div className="right-panel">
            <RightPanel />
          </div>
        )}
      </div>

      <style>{`
        /* ── Desktop ── */
        .desktop-sidebar { display: block; }
        .mobile-nav      { display: none; }

        .page-wrapper {
          margin-left: 220px;
          display: flex;
          justify-content: center;
          min-height: 100dvh;
          padding: 0 32px;
          gap: 40px;
          box-sizing: border-box;
        }

        .page-main {
          flex: 1;
          max-width: 640px;
          padding: 32px 0 80px;
          min-width: 0;
        }

        .right-panel {
          display: block;
          width: 280px;
          flex-shrink: 0;
        }

        /* ── Tablet: no right panel ── */
        @media (max-width: 1100px) {
          .right-panel   { display: none; }
          .page-wrapper  { gap: 0; }
        }

        /* ── Mobile: bottom nav, no sidebar ── */
        .mobile-bottom-nav { display: none; }

        @media (max-width: 767px) {
          .desktop-sidebar        { display: none; }
          .desktop-sidebar aside  { display: none; } /* belt-and-suspenders for position:fixed children */
          .mobile-bottom-nav  { display: block; }
          .page-wrapper {
            margin-left: 0;
            padding: 0 16px;
          }
          .page-main {
            padding-top: 24px;
            padding-bottom: calc(64px + env(safe-area-inset-bottom) + 16px);
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}
