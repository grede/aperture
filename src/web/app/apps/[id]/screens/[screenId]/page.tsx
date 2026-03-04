'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEVICE_TYPE_LABELS, SUPPORTED_LOCALES } from '@/lib/constants';
import type { AppWithScreens, DeviceType, Screen, ScreenLocalizedVariant } from '@/types';

function localeLabel(localeCode: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === localeCode)?.name || localeCode;
}

function variantSort(a: ScreenLocalizedVariant, b: ScreenLocalizedVariant): number {
  const localeCompare = localeLabel(a.locale).localeCompare(localeLabel(b.locale));
  if (localeCompare !== 0) {
    return localeCompare;
  }
  return DEVICE_TYPE_LABELS[a.device_type].localeCompare(DEVICE_TYPE_LABELS[b.device_type]);
}

export default function ScreenDetailsPage() {
  const params = useParams();
  const appId = Number.parseInt(params.id as string, 10);
  const screenId = Number.parseInt(params.screenId as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [screen, setScreen] = useState<Screen | null>(null);
  const [locale, setLocale] = useState('en');
  const [deviceType, setDeviceType] = useState<DeviceType>('iPhone');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableDevices = useMemo(
    () => (screen ? screen.variants.map((variant) => variant.device_type) : []),
    [screen]
  );

  const sortedLocalizedVariants = useMemo(
    () => [...(screen?.localized_variants || [])].sort(variantSort),
    [screen]
  );

  const existingVariant = useMemo(() => {
    if (!screen) {
      return null;
    }

    return (
      screen.localized_variants.find(
        (candidate) => candidate.locale === locale && candidate.device_type === deviceType
      ) || null
    );
  }, [screen, locale, deviceType]);

  useEffect(() => {
    if (!screen) {
      return;
    }

    if (!availableDevices.includes(deviceType)) {
      setDeviceType(availableDevices[0] || 'iPhone');
    }
  }, [availableDevices, deviceType, screen]);

  useEffect(() => {
    loadData();
  }, [appId, screenId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [appResponse, screenResponse] = await Promise.all([
        fetch(`/api/apps/${appId}`),
        fetch(`/api/screens/${screenId}`),
      ]);

      if (!appResponse.ok) {
        throw new Error('App not found');
      }
      if (!screenResponse.ok) {
        throw new Error('Screen not found');
      }

      const appPayload = await appResponse.json();
      const screenPayload = await screenResponse.json();
      const loadedApp = appPayload.data as AppWithScreens;
      const loadedScreen = screenPayload.data as Screen;

      if (loadedScreen.app_id !== loadedApp.id) {
        throw new Error('Screen does not belong to this app');
      }

      setApp(loadedApp);
      setScreen(loadedScreen);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load screen details');
    } finally {
      setLoading(false);
    }
  };

  const uploadLocalizedVariant = async () => {
    if (!screen) {
      return;
    }

    if (!file) {
      setError('Select a screenshot file first');
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('locale', locale);
      formData.append('deviceType', deviceType);

      const response = await fetch(`/api/screens/${screen.id}/localized-variants`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save localized variant');
      }

      setFile(null);
      setStatusMessage(
        existingVariant
          ? `Replaced ${localeLabel(locale)} (${DEVICE_TYPE_LABELS[deviceType]}) screenshot.`
          : `Added ${localeLabel(locale)} (${DEVICE_TYPE_LABELS[deviceType]}) screenshot.`
      );
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save localized variant');
    } finally {
      setSaving(false);
    }
  };

  const deleteLocalizedVariant = async (variantId: number) => {
    if (!screen) {
      return;
    }

    setDeletingVariantId(variantId);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/screens/${screen.id}/localized-variants/${variantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete localized variant');
      }

      setStatusMessage('Localized screenshot removed.');
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Failed to delete localized variant'
      );
    } finally {
      setDeletingVariantId(null);
    }
  };

  if (loading) {
    return <div className="max-w-5xl space-y-4">Loading screen details...</div>;
  }

  if (!app || !screen) {
    return (
      <div className="max-w-5xl space-y-4">
        <p className="text-sm text-destructive">{error || 'Screen not found'}</p>
        <Link href={`/apps/${appId}`}>
          <Button variant="outline" size="sm">
            Back to app
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Screen {screen.position + 1}</h1>
          <p className="text-sm text-muted-foreground">{app.name}</p>
        </div>
        <Link href={`/apps/${app.id}`}>
          <Button variant="outline" size="sm">
            Back to Screens
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base Screenshots</CardTitle>
          <CardDescription>
            These are fallback screenshots used when no localized version exists for a selected
            language.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {screen.variants.map((variant) => (
            <div key={variant.id} className="space-y-2 rounded-md border p-3">
              <Badge variant="secondary">{DEVICE_TYPE_LABELS[variant.device_type]}</Badge>
              <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-muted">
                <Image
                  src={`/api/uploads/${variant.screenshot_path}`}
                  alt={`${DEVICE_TYPE_LABELS[variant.device_type]} base screenshot`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localized Versions</CardTitle>
          <CardDescription>
            Add locale-specific screenshots per device. Generation prefers localized screenshots
            first, then falls back to base screenshots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Locale</Label>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SUPPORTED_LOCALES.map((supportedLocale) => (
                  <option key={supportedLocale.code} value={supportedLocale.code}>
                    {supportedLocale.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Device</Label>
              <select
                value={deviceType}
                onChange={(event) => setDeviceType(event.target.value as DeviceType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {availableDevices.map((availableDeviceType) => (
                  <option key={availableDeviceType} value={availableDeviceType}>
                    {DEVICE_TYPE_LABELS[availableDeviceType]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Screenshot</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </div>
          </div>

          {existingVariant && (
            <p className="text-xs text-muted-foreground">
              A screenshot for this locale and device already exists. Uploading will replace it.
            </p>
          )}

          <Button onClick={uploadLocalizedVariant} disabled={saving || !file}>
            {saving
              ? 'Saving...'
              : existingVariant
                ? 'Replace Localized Screenshot'
                : 'Add Localized Screenshot'}
          </Button>

          {sortedLocalizedVariants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No localized screenshots yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedLocalizedVariants.map((variant) => (
                <div key={variant.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline">{localeLabel(variant.locale)}</Badge>
                      <Badge variant="secondary">{DEVICE_TYPE_LABELS[variant.device_type]}</Badge>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deletingVariantId === variant.id}
                      onClick={() => deleteLocalizedVariant(variant.id)}
                    >
                      {deletingVariantId === variant.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                  <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-muted">
                    <Image
                      src={`/api/uploads/${variant.screenshot_path}`}
                      alt={`${localeLabel(variant.locale)} ${DEVICE_TYPE_LABELS[variant.device_type]} screenshot`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {statusMessage && (
        <p className="text-sm text-green-700" role="status">
          {statusMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
