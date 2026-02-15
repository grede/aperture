'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { App } from '@/types';
import { formatDistance } from 'date-fns';

interface AppCardProps {
  app: App & { screens?: any[] };
}

export function AppCard({ app }: AppCardProps) {
  const screenCount = app.screens?.length || 0;
  const createdAt = new Date(app.created_at);

  return (
    <Link href={`/apps/${app.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl mb-2">{app.name}</CardTitle>
              <CardDescription className="line-clamp-2">
                {app.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              {screenCount} {screenCount === 1 ? 'screen' : 'screens'}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {formatDistance(createdAt, new Date(), { addSuffix: true })}
            </p>
          </div>

          <Button
            size="sm"
            className="w-full"
            aria-label={`View details for ${app.name}`}
          >
            View Details
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
