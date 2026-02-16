'use client';

import Link from 'next/link';
import { AppTabs } from './AppTabs';
import { AppSelector } from './AppSelector';

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="flex h-16 items-center justify-between gap-8">
          {/* Logo - Left */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-semibold text-lg">A</span>
            </div>
            <span className="text-lg font-semibold hidden sm:inline">Aperture</span>
          </Link>

          {/* Tabs - Center (context-aware) */}
          <div className="flex-1 flex justify-center">
            <AppTabs />
          </div>

          {/* App Selector - Right */}
          <div className="flex-shrink-0">
            <AppSelector />
          </div>
        </div>
      </div>
    </header>
  );
}
