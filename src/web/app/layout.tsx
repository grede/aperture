import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Header } from '@/components/layout/Header';
import { AppTabsProvider } from '@/components/layout/AppTabsContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aperture - Screenshot Management',
  description: 'AI-powered app store screenshot automation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${GeistSans.className} antialiased`}>
        <AppTabsProvider>
          <div className="flex flex-col h-screen">
            <Header />
            <main className="flex-1 overflow-y-auto">
              <div className="container mx-auto px-6 py-8 max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </AppTabsProvider>
      </body>
    </html>
  );
}
