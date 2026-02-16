'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Generation } from '@/types';

export default function GenerationsListPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params?.id as string;

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGenerations();
  }, [appId]);

  const fetchGenerations = async () => {
    try {
      const response = await fetch(`/api/apps/${appId}/generations`);
      const data = await response.json();
      setGenerations(data.data || []);
    } catch (error) {
      console.error('Failed to load generations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generation Results</h1>
          <p className="text-muted-foreground">Loading generations...</p>
        </div>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generation Results</h1>
          <p className="text-muted-foreground">View your screenshot generation history</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No generations yet</CardTitle>
            <CardDescription>
              You haven't generated any screenshots yet. Go to the Generate tab to create your first
              set of screenshots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/apps/${appId}/generate`)}>
              Go to Generate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generation Results</h1>
        <p className="text-muted-foreground">
          {generations.length} generation{generations.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-4">
        {generations.map((generation) => (
          <Card key={generation.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Generation #{generation.id}</CardTitle>
                  <CardDescription>{formatDate(generation.created_at)}</CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(generation.status)}>
                  {generation.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Devices:</span>{' '}
                    <span className="font-medium">{generation.config.devices.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Locales:</span>{' '}
                    <span className="font-medium">{generation.config.locales.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Template:</span>{' '}
                    <span className="font-medium">{generation.config.template_style}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Progress:</span>{' '}
                    <span className="font-medium">{generation.progress}%</span>
                  </div>
                </div>

                {generation.error && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {generation.error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={generation.status !== 'completed'}
                  >
                    <Link href={`/apps/${appId}/generations/${generation.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
