'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GenerationWithScreenshots } from '@/types';

export default function GenerationResultsPage() {
  const params = useParams();
  const generationId = parseInt(params.generationId as string, 10);

  const [generation, setGeneration] = useState<GenerationWithScreenshots | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGeneration();
    const interval = setInterval(loadStatus, 1000);
    return () => clearInterval(interval);
  }, [generationId]);

  const loadGeneration = async () => {
    const response = await fetch(`/api/generations/${generationId}`);
    const data = await response.json();
    setGeneration(data.data);
    setLoading(false);
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

  if (loading) return <div className="container mx-auto py-8">Loading...</div>;
  if (!generation) return <div className="container mx-auto py-8">Generation not found</div>;

  const isProcessing = generation.status === 'pending' || generation.status === 'processing';

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
          <h2 className="text-2xl font-bold mb-4">
            Generated Screenshots ({generation.screenshots.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {generation.screenshots.map((screenshot) => (
              <Card key={screenshot.id} className="overflow-hidden">
                <div className="relative aspect-[9/16] bg-muted">
                  <Image
                    src={`/api/generated-images/${screenshot.output_path}`}
                    alt={`${screenshot.locale} - Screen ${screenshot.screen_id}`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {screenshot.locale}
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/api/generated-images/${screenshot.output_path}`} download>
                        Download
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
