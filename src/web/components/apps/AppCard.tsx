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
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-xl">{app.name}</CardTitle>
            <CardDescription className="line-clamp-2">{app.description}</CardDescription>
          </div>
          <Badge variant="secondary">{screenCount} screens</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Created {formatDistance(createdAt, new Date(), { addSuffix: true })}
          </p>
          <Link href={`/apps/${app.id}`}>
            <Button size="sm">View Details</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
