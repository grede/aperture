'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { App } from '@/types';
import { formatDistance } from 'date-fns';

interface AppCardProps {
  app: App & { screens?: any[] };
}

export function AppCard({ app }: AppCardProps) {
  const screenCount = app.screens?.length || 0;
  const createdAt = new Date(app.created_at);

  return (
    <Link href={`/apps/${app.id}`} className="group block">
      <Card className="h-full border border-border hover:border-slate-700 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-medium mb-1.5 group-hover:text-primary transition-colors">
                {app.name}
              </CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                {app.description}
              </CardDescription>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">
              {screenCount} {screenCount === 1 ? 'screen' : 'screens'}
            </Badge>
            <span>
              {formatDistance(createdAt, new Date(), { addSuffix: true })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
