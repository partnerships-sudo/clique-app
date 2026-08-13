import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@web/providers/query-provider';
import { SessionProvider } from '@web/providers/session-provider';
import { ThemeProvider } from '@web/providers/theme-provider';
import { LogModalProvider } from '@web/providers/log-modal-provider';
import { AppShell } from '@web/components/ui/app-shell';
import { LogModal } from '@web/components/ui/log-modal';

export const metadata: Metadata = {
  metadataBase: new URL('https://clique.app'),
  title: { default: 'Clique', template: '%s · Clique' },
  description: 'Watch, read, play, listen — together.',
  icons: { icon: '/logo-icon.png' },
  openGraph: {
    siteName: 'Clique',
    images: [{ url: '/logo-icon.png', width: 512, height: 512 }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <QueryProvider>
              <LogModalProvider>
                <AppShell>{children}</AppShell>
                <LogModal />
              </LogModalProvider>
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
