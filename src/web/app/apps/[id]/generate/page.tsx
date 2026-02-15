'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  TEMPLATE_STYLES,
  TEMPLATE_STYLE_INFO,
  FRAME_MODES,
  DEVICE_TYPE_LABELS,
  SUPPORTED_LOCALES,
} from '@/lib/constants';
import type {
  AppWithScreens,
  CopiesByScreenAndLocale,
  DeviceType,
  FrameMode,
  FrameModesByDevice,
} from '@/types';

function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.name || code;
}

function collectSavedLocales(copies: CopiesByScreenAndLocale): string[] {
  const localeSet = new Set<string>();
  Object.values(copies).forEach((byLocale) => {
    Object.keys(byLocale).forEach((locale) => localeSet.add(locale));
  });
  return Array.from(localeSet).sort((a, b) => localeLabel(a).localeCompare(localeLabel(b)));
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [copies, setCopies] = useState<CopiesByScreenAndLocale>({});
  const [selectedDevices, setSelectedDevices] = useState<DeviceType[]>([]);
  const [selectedLocales, setSelectedLocales] = useState<string[]>([]);
  const [templateStyle, setTemplateStyle] = useState('modern');
  const [frameModesByDevice, setFrameModesByDevice] = useState<FrameModesByDevice>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const availableDevices = useMemo(() => {
    if (!app) return [];
    return Array.from(
      new Set(app.screens.map((screen) => screen.device_type))
    ) as DeviceType[];
  }, [app]);

  const availableLocales = useMemo(() => collectSavedLocales(copies), [copies]);

  useEffect(() => {
    loadData();
  }, [appId]);

  useEffect(() => {
    if (!app) return;

    setSelectedDevices((prev) => {
      if (prev.length > 0) {
        return prev.filter((device) => availableDevices.includes(device));
      }
      return [...availableDevices];
    });

    setSelectedLocales((prev) => {
      if (availableLocales.length === 0) return [];
      if (prev.length > 0) {
        return prev.filter((locale) => availableLocales.includes(locale));
      }
      if (availableLocales.includes('en')) return ['en'];
      return [availableLocales[0]];
    });

    setFrameModesByDevice((prev) => {
      const next: FrameModesByDevice = {};
      availableDevices.forEach((deviceType) => {
        next[deviceType] = prev[deviceType] || 'minimal';
      });
      return next;
    });
  }, [app, availableDevices, availableLocales]);

  useEffect(() => {
    const generatePreview = async () => {
      if (!app || selectedDevices.length === 0) {
        setPreviewImage(null);
        return;
      }

      const previewDevice = selectedDevices[0];
      const previewScreen = app.screens.find(
        (screen) => screen.device_type === previewDevice
      );

      if (!previewScreen) {
        setPreviewImage(null);
        return;
      }

      const defaultCopy =
        copies[previewScreen.id]?.en ||
        copies[previewScreen.id]?.[Object.keys(copies[previewScreen.id] || {})[0]];

      if (!defaultCopy) {
        setPreviewError('Add at least one copy before generating preview.');
        setPreviewImage(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const imageResponse = await fetch(`/api/uploads/${previewScreen.screenshot_path}`);
        if (!imageResponse.ok) {
          throw new Error('Failed to load source screenshot');
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const screenshotBase64 = bufferToBase64(imageBuffer);

        const previewResponse = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot_base64: screenshotBase64,
            style: templateStyle,
            device_type: previewDevice,
            title: defaultCopy.title,
            subtitle: defaultCopy.subtitle || '',
            frame_mode: frameModesByDevice[previewDevice] || 'minimal',
          }),
        });

        if (!previewResponse.ok) {
          throw new Error('Failed to generate template preview');
        }

        const payload = await previewResponse.json();
        setPreviewImage(`data:image/png;base64,${payload.data.image_base64}`);
      } catch (previewGenerationError) {
        setPreviewImage(null);
        setPreviewError(
          previewGenerationError instanceof Error
            ? previewGenerationError.message
            : 'Failed to generate preview'
        );
      } finally {
        setPreviewLoading(false);
      }
    };

    generatePreview();
  }, [app, copies, selectedDevices, templateStyle, frameModesByDevice]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [appResponse, copiesResponse] = await Promise.all([
        fetch(`/api/apps/${appId}`),
        fetch(`/api/apps/${appId}/copies`),
      ]);

      if (!appResponse.ok) {
        throw new Error('App not found');
      }
      if (!copiesResponse.ok) {
        throw new Error('Failed to load copies');
      }

      const appPayload = await appResponse.json();
      const copiesPayload = await copiesResponse.json();

      setApp(appPayload.data);
      setCopies(copiesPayload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load generation setup');
    } finally {
      setLoading(false);
    }
  };

  const toggleDevice = (deviceType: DeviceType) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceType)
        ? prev.filter((device) => device !== deviceType)
        : [...prev, deviceType]
    );
  };

  const toggleLocale = (localeCode: string) => {
    setSelectedLocales((prev) =>
      prev.includes(localeCode)
        ? prev.filter((locale) => locale !== localeCode)
        : [...prev, localeCode]
    );
  };

  const setDeviceFrameMode = (deviceType: DeviceType, frameMode: FrameMode) => {
    setFrameModesByDevice((prev) => ({ ...prev, [deviceType]: frameMode }));
  };

  const startGeneration = async () => {
    setGenerating(true);
    setError(null);

    try {
      const selectedDeviceFrameModes: FrameModesByDevice = {};
      selectedDevices.forEach((deviceType) => {
        selectedDeviceFrameModes[deviceType] = frameModesByDevice[deviceType] || 'minimal';
      });

      const response = await fetch(`/api/apps/${appId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devices: selectedDevices,
          locales: selectedLocales,
          template_style: templateStyle,
          frame_mode: 'minimal',
          frame_modes: selectedDeviceFrameModes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to start generation');
      }

      const data = await response.json();
      router.push(`/apps/${appId}/generations/${data.data.generation_id}`);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Failed to start generation'
      );
      setGenerating(false);
    }
  };

  if (loading) return <div className="container mx-auto py-8">Loading...</div>;
  if (!app) return <div className="container mx-auto py-8">App not found</div>;

  const selectedScreensCount = app.screens.filter((screen) =>
    selectedDevices.includes(screen.device_type)
  ).length;
  const estimatedOutputCount = selectedScreensCount * selectedLocales.length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate Screenshots</h1>
        <p className="text-muted-foreground">{app.name}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Select Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {availableDevices.map((device) => (
                <Button
                  key={device}
                  variant={selectedDevices.includes(device) ? 'default' : 'outline'}
                  onClick={() => toggleDevice(device)}
                >
                  {DEVICE_TYPE_LABELS[device]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Choose Frame Per Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedDevices.map((deviceType) => (
              <div key={deviceType}>
                <Label className="mb-2 block">{DEVICE_TYPE_LABELS[deviceType]}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FRAME_MODES.map((mode) => (
                    <button
                      key={`${deviceType}-${mode.value}`}
                      type="button"
                      onClick={() => setDeviceFrameMode(deviceType, mode.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        (frameModesByDevice[deviceType] || 'minimal') === mode.value
                          ? 'border-primary bg-primary/10'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      <div className="mb-2 h-10 w-8 rounded-sm border border-foreground/40 bg-background mx-auto" />
                      <p className="font-medium text-sm">{mode.label}</p>
                      <p className="text-xs text-muted-foreground">{mode.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Select Languages</CardTitle>
          </CardHeader>
          <CardContent>
            {availableLocales.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved locales found. Add copy first in Manage Copies.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableLocales.map((localeCode) => (
                  <Button
                    key={localeCode}
                    size="sm"
                    variant={selectedLocales.includes(localeCode) ? 'default' : 'outline'}
                    onClick={() => toggleLocale(localeCode)}
                  >
                    {localeLabel(localeCode)}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Choose Template Style</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {TEMPLATE_STYLES.map((style) => (
                <Button
                  key={style}
                  variant={templateStyle === style ? 'default' : 'outline'}
                  className="h-auto flex-col items-start p-4"
                  onClick={() => setTemplateStyle(style)}
                >
                  <div className="font-semibold mb-1">{TEMPLATE_STYLE_INFO[style].name}</div>
                  <div className="text-xs text-left">
                    {TEMPLATE_STYLE_INFO[style].description}
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Preview (Default English Copy)</CardTitle>
          </CardHeader>
          <CardContent>
            {previewLoading && (
              <p className="text-sm text-muted-foreground">Rendering preview...</p>
            )}
            {!previewLoading && previewImage && (
              <div className="relative aspect-[9/16] max-w-xs mx-auto rounded-md border bg-muted">
                <Image
                  src={previewImage}
                  alt="Template preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            {!previewLoading && previewError && (
              <p className="text-sm text-destructive">{previewError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedScreensCount} selected screen(s) × {selectedLocales.length} locale(s) ={' '}
                {estimatedOutputCount} output image(s)
              </div>
              <Button
                size="lg"
                onClick={startGeneration}
                disabled={
                  generating ||
                  selectedDevices.length === 0 ||
                  selectedLocales.length === 0
                }
                className="w-full max-w-md"
              >
                {generating ? 'Starting Generation...' : 'Generate Screenshots'}
              </Button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
