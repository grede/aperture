'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatDistance } from 'date-fns';
import { ScreenCard } from '@/components/screens/ScreenCard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CHARACTER_LIMITS,
  DEVICE_TYPES,
  DEVICE_TYPE_LABELS,
} from '@/lib/constants';
import type { AppWithScreens, DeviceType, Generation } from '@/types';

export default function AppDetailsPage() {
  const params = useParams();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDeviceType, setUploadDeviceType] = useState<DeviceType>('iPhone');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSubtitle, setUploadSubtitle] = useState('');

  const completedGenerations = useMemo(
    () => generations.filter((generation) => generation.status === 'completed'),
    [generations]
  );

  useEffect(() => {
    loadData();
  }, [appId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [appResponse, generationsResponse] = await Promise.all([
        fetch(`/api/apps/${appId}`),
        fetch(`/api/apps/${appId}/generations`),
      ]);

      if (!appResponse.ok) {
        throw new Error('App not found');
      }

      const appPayload = await appResponse.json();
      const generationsPayload = generationsResponse.ok
        ? await generationsResponse.json()
        : { data: [] };

      setApp(appPayload.data);
      setGenerations(generationsPayload.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load app');
    } finally {
      setLoading(false);
    }
  };

  const uploadScreen = async () => {
    if (!uploadFile) {
      setError('Select a screenshot file first');
      return;
    }

    if (!uploadTitle.trim()) {
      setError('Title is required');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('deviceType', uploadDeviceType);
      formData.append('title', uploadTitle.trim());
      formData.append('subtitle', uploadSubtitle.trim());

      const response = await fetch(`/api/apps/${appId}/screens`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload screenshot');
      }

      setUploadFile(null);
      setUploadTitle('');
      setUploadSubtitle('');
      await loadData();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Failed to upload screenshot'
      );
    } finally {
      setUploading(false);
    }
  };

  const deleteScreen = async (screenId: number) => {
    setError(null);

    const response = await fetch(`/api/screens/${screenId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      setError('Failed to delete screen');
      return;
    }

    await loadData();
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
        <div className="h-4 w-96 bg-secondary rounded animate-pulse" />
        <div className="h-64 bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-medium mb-2">App Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          The app you're looking for doesn't exist
        </p>
        <Link href="/">
          <Button>Back to Apps</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Minimal Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold mb-1">{app.name}</h1>
            <p className="text-sm text-muted-foreground">{app.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/apps/${app.id}/copies`}>
              <Button variant="outline" size="sm">
                Manage Copies
              </Button>
            </Link>
            <Link href={`/apps/${app.id}/generate`}>
              <Button size="sm">
                Generate Screenshots
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-4">

      {/* Add Screen Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add Screen</CardTitle>
          <CardDescription>
            Upload raw screenshot and set default English copy for this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          <div className="space-y-2 md:col-span-2">
            <Label>Screenshot</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-2">
            <Label>Device Type</Label>
            <select
              value={uploadDeviceType}
              onChange={(event) => setUploadDeviceType(event.target.value as DeviceType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DEVICE_TYPES.map((deviceType) => (
                <option key={deviceType} value={deviceType}>
                  {DEVICE_TYPE_LABELS[deviceType]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              maxLength={CHARACTER_LIMITS.title}
              placeholder="Powerful editing in one tap"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Subtitle (optional)</Label>
            <Input
              value={uploadSubtitle}
              onChange={(event) => setUploadSubtitle(event.target.value)}
              maxLength={CHARACTER_LIMITS.subtitle}
              placeholder="Create polished visuals in seconds"
            />
          </div>

          <div className="md:col-span-2">
            <Button onClick={uploadScreen} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Screen'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Screens Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Screens</CardTitle>
              <CardDescription>
                Manage uploaded screenshots across iPhone, iPad, Android phone, and tablet.
              </CardDescription>
            </div>
            {app.screens.length > 0 && (
              <Badge variant="secondary">
                {app.screens.length} {app.screens.length === 1 ? 'screen' : 'screens'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {app.screens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screens yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {app.screens.map((screen) => (
                <ScreenCard
                  key={screen.id}
                  screen={screen}
                  onDelete={() => deleteScreen(screen.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation History Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generation History</CardTitle>
              <CardDescription>
                Previous screenshot runs remain available for download and review.
              </CardDescription>
            </div>
            {completedGenerations.length > 0 && (
              <Badge variant="secondary">
                {completedGenerations.length} completed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {generations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No generations yet.</p>
          ) : (
            <div className="space-y-3">
              {generations.map((generation) => (
                <div
                  key={generation.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">Generation #{generation.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistance(new Date(generation.created_at), new Date(), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
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
                    <Link href={`/apps/${app.id}/generations/${generation.id}`}>
                      <Button size="sm" variant="outline">
                        Open
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      </div>
    </div>
  );
}
