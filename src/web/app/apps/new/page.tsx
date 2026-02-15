'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CHARACTER_LIMITS,
  DEVICE_TYPES,
  DEVICE_TYPE_LABELS,
} from '@/lib/constants';
import type { DeviceType } from '@/types';

type ScreenDraft = {
  id: number;
  file: File | null;
  deviceType: DeviceType;
  title: string;
  subtitle: string;
};

function createEmptyScreen(id: number): ScreenDraft {
  return {
    id,
    file: null,
    deviceType: 'iPhone',
    title: '',
    subtitle: '',
  };
}

export default function NewAppPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [screens, setScreens] = useState<ScreenDraft[]>([createEmptyScreen(1)]);
  const [nextScreenId, setNextScreenId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateScreen = (id: number, updates: Partial<ScreenDraft>) => {
    setScreens((prev) =>
      prev.map((screen) => (screen.id === id ? { ...screen, ...updates } : screen))
    );
  };

  const addScreen = () => {
    setScreens((prev) => [...prev, createEmptyScreen(nextScreenId)]);
    setNextScreenId((prev) => prev + 1);
  };

  const removeScreen = (id: number) => {
    setScreens((prev) => prev.filter((screen) => screen.id !== id));
  };

  const validateScreen = (screen: ScreenDraft): string | null => {
    if (!screen.file) return 'Each screen must include a screenshot file';
    if (!screen.title.trim()) return 'Each screen must include an English title';
    if (screen.title.length > CHARACTER_LIMITS.title) {
      return `Screen title must be at most ${CHARACTER_LIMITS.title} characters`;
    }
    if (screen.subtitle.length > CHARACTER_LIMITS.subtitle) {
      return `Screen subtitle must be at most ${CHARACTER_LIMITS.subtitle} characters`;
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (screens.length === 0) {
      setError('Add at least one screen before saving');
      return;
    }

    for (const screen of screens) {
      const screenError = validateScreen(screen);
      if (screenError) {
        setError(screenError);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const createAppResponse = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (!createAppResponse.ok) {
        throw new Error('Failed to create app');
      }

      const appPayload = await createAppResponse.json();
      const appId = appPayload.data.id as number;

      for (const screen of screens) {
        const formData = new FormData();
        formData.append('file', screen.file as File);
        formData.append('deviceType', screen.deviceType);
        formData.append('title', screen.title.trim());
        formData.append('subtitle', screen.subtitle.trim());

        const uploadResponse = await fetch(`/api/apps/${appId}/screens`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload one of the screens`);
        }
      }

      router.push(`/apps/${appId}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to create app'
      );
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Create App</h1>
        <p className="mt-2 text-muted-foreground">
          Define app metadata, then upload raw screenshots and default English copy.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>App Details</CardTitle>
            <CardDescription>
              This information is used for organization and AI copy generation context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-name">App Name</Label>
              <Input
                id="app-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My Awesome App"
                required
                maxLength={CHARACTER_LIMITS.appName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-description">Description</Label>
              <Textarea
                id="app-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A short description of what the app does..."
                required
                rows={4}
                maxLength={CHARACTER_LIMITS.appDescription}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Screens</CardTitle>
                <CardDescription>
                  Add at least one screenshot with its default English title/subtitle.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={addScreen}>
                Add Screen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {screens.map((screen, index) => (
              <Card key={screen.id} className="border-dashed">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Screen {index + 1}</p>
                    {screens.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeScreen(screen.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Screenshot</Label>
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      required
                      onChange={(event) =>
                        updateScreen(screen.id, {
                          file: event.target.files?.[0] || null,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Device Type</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={screen.deviceType}
                      onChange={(event) =>
                        updateScreen(screen.id, {
                          deviceType: event.target.value as DeviceType,
                        })
                      }
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
                      value={screen.title}
                      onChange={(event) =>
                        updateScreen(screen.id, { title: event.target.value })
                      }
                      maxLength={CHARACTER_LIMITS.title}
                      placeholder="Powerful editing in one tap"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Subtitle (optional)</Label>
                    <Input
                      value={screen.subtitle}
                      onChange={(event) =>
                        updateScreen(screen.id, { subtitle: event.target.value })
                      }
                      maxLength={CHARACTER_LIMITS.subtitle}
                      placeholder="Design pro visuals in seconds"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={saving} className="w-full">
          {saving ? 'Saving App...' : 'Save App'}
        </Button>
      </form>
    </div>
  );
}
