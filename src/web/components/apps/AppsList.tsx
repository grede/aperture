'use client';

import { AppCard } from './AppCard';
import type { App } from '@/types';

interface AppsListProps {
  apps: App[];
}

export function AppsList({ apps }: AppsListProps) {
  if (apps.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-muted-foreground">No apps yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Create your first app to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} />
      ))}
    </div>
  );
}
