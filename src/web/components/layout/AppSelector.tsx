'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDown, Plus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { App } from '@/types';

export function AppSelector() {
  const router = useRouter();
  const params = useParams();
  const appId = params?.id ? parseInt(params.id as string, 10) : null;

  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentApp, setCurrentApp] = useState<App | null>(null);

  useEffect(() => {
    fetchApps();
  }, []);

  useEffect(() => {
    if (appId && apps.length > 0) {
      setCurrentApp(apps.find((app) => app.id === appId) || null);
    } else {
      setCurrentApp(null);
    }
  }, [appId, apps]);

  const fetchApps = async () => {
    try {
      const response = await fetch('/api/apps');
      const data = await response.json();
      setApps(data.data || []);
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayText = currentApp?.name || 'My Apps';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {loading ? 'Loading...' : displayText}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {apps.map((app) => (
          <DropdownMenuItem
            key={app.id}
            onClick={() => router.push(`/apps/${app.id}`)}
            className={appId === app.id ? 'bg-accent' : ''}
          >
            {app.name}
          </DropdownMenuItem>
        ))}
        {apps.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => router.push('/apps/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Your App
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
