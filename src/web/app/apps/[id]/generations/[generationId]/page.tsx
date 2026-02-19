'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import type { AppWithScreens, GenerationWithScreenshots, GeneratedScreenshot } from '@/types';

function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.name || code;
}

export default function GenerationResultsPage() {
  const params = useParams();
  const appId = parseInt(params.id as string, 10);
  const generationId = parseInt(params.generationId as string, 10);

  const [generation, setGeneration] = useState<GenerationWithScreenshots | null>(null);
  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGeneration();
    const interval = setInterval(loadStatus, 1000);
    return () => clearInterval(interval);
  }, [appId, generationId]);

  const loadGeneration = async () => {
    try {
      const [generationResponse, appResponse] = await Promise.all([
        fetch(`/api/generations/${generationId}`),
        fetch(`/api/apps/${appId}`),
      ]);
      const generationPayload = await generationResponse.json();
      const appPayload = await appResponse.json();
      setGeneration(generationPayload.data || null);
      setApp(appPayload.data || null);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    const response = await fetch(`/api/generations/${generationId}/status`);
    const data = await response.json();

    if (data.data.status === 'completed' || data.data.status === 'failed') {
      loadGeneration();
    } else {
      setGeneration((prev) =>
        prev
          ? {
              ...prev,
              status: data.data.status,
              progress: data.data.progress,
              error: data.data.error,
            }
          : null
      );
    }
  };

  const screenOrderById = useMemo(() => {
    const map = new Map<number, number>();
    app?.screens.forEach((screen) => {
      map.set(screen.id, screen.position + 1);
    });
    return map;
  }, [app]);
  const groupedScreenshots = useMemo(() => {
    if (!generation) {
      return [];
    }

    const groups = new Map<string, GeneratedScreenshot[]>();
    generation.screenshots.forEach((screenshot) => {
      const group = groups.get(screenshot.locale) || [];
      group.push(screenshot);
      groups.set(screenshot.locale, group);
    });

    return Array.from(groups.entries())
      .sort((a, b) => localeLabel(a[0]).localeCompare(localeLabel(b[0])))
      .map(([locale, screenshots]) => ({
        locale,
        screenshots: [...screenshots].sort((a, b) => {
          const orderA = screenOrderById.get(a.screen_id) ?? a.screen_id;
          const orderB = screenOrderById.get(b.screen_id) ?? b.screen_id;
          return orderA - orderB;
        }),
      }));
  }, [generation, screenOrderById]);
  const isProcessing =
    generation?.status === 'pending' || generation?.status === 'processing';

  const screenLabel = (screenId: number) => `Screen ${screenOrderById.get(screenId) ?? screenId}`;
  const downloadArchive = (locale?: string) => {
    const downloadPath = locale
      ? `/api/generations/${generationId}/download?locale=${encodeURIComponent(locale)}`
      : `/api/generations/${generationId}/download`;
    const link = document.createElement('a');
    link.href = downloadPath;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="container mx-auto py-8">Loading...</div>;
  if (!generation) return <div className="container mx-auto py-8">Generation not found</div>;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Generation Results</h1>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  generation.status === 'completed'
                    ? 'default'
                    : generation.status === 'failed'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {generation.status}
              </Badge>
              {isProcessing && (
                <span className="text-sm text-muted-foreground">
                  {generation.progress}% complete
                </span>
              )}
            </div>
          </div>
        </div>

        {isProcessing && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Generating screenshots...</span>
                  <span>{generation.progress}%</span>
                </div>
                <Progress value={generation.progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {generation.error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{generation.error}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {generation.screenshots.length > 0 && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold">
              Generated Screenshots ({generation.screenshots.length})
            </h2>
            <Button
              variant="outline"
              onClick={() => downloadArchive()}
            >
              Download All
            </Button>
          </div>
          <div className="space-y-8">
            {groupedScreenshots.map((group) => (
              <div key={group.locale}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{localeLabel(group.locale)}</h3>
                    <Badge variant="outline">{group.locale}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadArchive(group.locale)}
                  >
                    Download Locale
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.screenshots.map((screenshot) => (
                    <Card key={screenshot.id} className="overflow-hidden">
                      <div className="relative aspect-[9/16] bg-muted">
                        <Image
                          src={`/api/generated-images/${screenshot.output_path}`}
                          alt={`${group.locale} - ${screenLabel(screenshot.screen_id)}`}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {screenLabel(screenshot.screen_id)}
                          </Badge>
                          <a
                            href={`/api/generated-images/${screenshot.output_path}`}
                            download
                            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            Download
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
