'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEVICE_TYPE_LABELS, SUPPORTED_LOCALES } from '@/lib/constants';
import type {
  AppWithScreens,
  CopiesByScreenAndLocale,
  DeviceType,
  FrameAssetFilesByDevice,
  FrameMode,
  FrameModesByDevice,
  TemplateBackground,
  TemplateStyle,
} from '@/types';

const BACKGROUND_TEMPLATE_STYLE: TemplateStyle = 'modern';
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SOLID_COLOR_PRESETS = [
  '#111827',
  '#0F766E',
  '#1D4ED8',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#DC2626',
  '#84CC16',
  '#F8FAFC',
];
const GRADIENT_PRESETS = [
  { from: '#4A90E2', to: '#7B68EE', label: 'Indigo Sky' },
  { from: '#FF6B6B', to: '#FFD93D', label: 'Sunset Pop' },
  { from: '#0EA5E9', to: '#14B8A6', label: 'Blue Mint' },
  { from: '#EC4899', to: '#8B5CF6', label: 'Berry Neon' },
  { from: '#22C55E', to: '#3B82F6', label: 'Fresh Ocean' },
  { from: '#F97316', to: '#EF4444', label: 'Warm Glow' },
];

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

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

function buildFramePreviewPath(deviceType: DeviceType, frameFile?: string): string {
  const params = new URLSearchParams({ device_type: deviceType });
  if (frameFile) {
    params.set('frame_file', frameFile);
  }
  return `/api/frame-assets/preview?${params.toString()}`;
}

function frameFileLabel(frameFile: string): string {
  return frameFile.replace(/\.png$/i, '');
}

function FrameModePreview({
  deviceType,
  mode,
  frameFile,
}: {
  deviceType: DeviceType;
  mode: FrameMode;
  frameFile?: string;
}) {
  const isTablet = deviceType === 'iPad' || deviceType === 'Android-tablet';
  const width = isTablet ? 66 : 48;
  const height = isTablet ? 86 : 94;
  const radius = isTablet ? 12 : 14;
  const screenRadius = mode === 'none' ? 8 : 10;

  if (mode === 'none') {
    return (
      <div className="mb-2 flex h-24 items-center justify-center">
        <div
          className="relative overflow-hidden rounded-lg bg-gradient-to-br from-sky-200 via-blue-100 to-cyan-100 shadow-sm"
          style={{ width: width - 4, height: height - 10 }}
        >
          <div className="absolute inset-x-2 top-3 h-1 rounded-full bg-white/70" />
          <div className="absolute inset-x-3 bottom-3 h-2 rounded-full bg-white/65" />
        </div>
      </div>
    );
  }

  if (mode === 'realistic') {
    const framePreviewPath = buildFramePreviewPath(deviceType, frameFile);
    return (
      <div className="mb-2 flex h-24 items-center justify-center">
        <img
          src={framePreviewPath}
          alt={`${deviceType} realistic frame preview`}
          className="max-h-[84px] w-auto object-contain"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div className="mb-2 flex h-24 items-center justify-center">
      <div
        className="relative flex items-center justify-center border border-foreground/40 bg-background"
        style={{ width, height, borderRadius: radius }}
      >
        <div
          className="relative overflow-hidden bg-gradient-to-br from-sky-300 via-blue-200 to-indigo-200"
          style={{
            width: width - 4,
            height: height - 4,
            borderRadius: screenRadius,
          }}
        >
          <div className="absolute inset-x-2 top-2 h-1 rounded-full bg-white/65" />
          <div className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-white/55" />
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [copies, setCopies] = useState<CopiesByScreenAndLocale>({});
  const [selectedDevices, setSelectedDevices] = useState<DeviceType[]>([]);
  const [selectedLocales, setSelectedLocales] = useState<string[]>([]);
  const [backgroundMode, setBackgroundMode] = useState<TemplateBackground['mode']>('solid');
  const [solidColor, setSolidColor] = useState('#4A90E2');
  const [gradientFrom, setGradientFrom] = useState('#4A90E2');
  const [gradientTo, setGradientTo] = useState('#7B68EE');
  const [frameModesByDevice, setFrameModesByDevice] = useState<FrameModesByDevice>({});
  const [frameAssetFilesByDevice, setFrameAssetFilesByDevice] = useState<
    Partial<Record<DeviceType, string[]>>
  >({});
  const [selectedFrameAssetFilesByDevice, setSelectedFrameAssetFilesByDevice] =
    useState<FrameAssetFilesByDevice>({});
  const [frameFilesLoadingByDevice, setFrameFilesLoadingByDevice] = useState<
    Partial<Record<DeviceType, boolean>>
  >({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequestIdRef = useRef(0);

  const availableDevices = useMemo(() => {
    if (!app) return [];
    return Array.from(new Set(app.screens.map((screen) => screen.device_type))) as DeviceType[];
  }, [app]);

  const availableLocales = useMemo(() => collectSavedLocales(copies), [copies]);
  const templateBackground = useMemo<TemplateBackground>(() => {
    if (backgroundMode === 'solid') {
      return {
        mode: 'solid',
        color: solidColor,
      };
    }

    return {
      mode: 'gradient',
      from: gradientFrom,
      to: gradientTo,
      angle: 135,
    };
  }, [backgroundMode, solidColor, gradientFrom, gradientTo]);

  const backgroundPreviewStyle = useMemo(() => {
    if (backgroundMode === 'solid') {
      return { backgroundColor: solidColor };
    }
    return {
      backgroundImage: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
    };
  }, [backgroundMode, solidColor, gradientFrom, gradientTo]);

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
    if (selectedDevices.length === 0) {
      return;
    }

    let cancelled = false;

    const loadFrameFilesForDevice = async (deviceType: DeviceType) => {
      setFrameFilesLoadingByDevice((prev) => ({ ...prev, [deviceType]: true }));

      try {
        const response = await fetch(
          `/api/frame-assets/options?device_type=${encodeURIComponent(deviceType)}`
        );
        if (!response.ok) {
          throw new Error(`Failed to load frame options for ${deviceType}`);
        }

        const payload = await response.json();
        const frameFiles = Array.isArray(payload?.data?.files)
          ? (payload.data.files as string[])
          : [];

        if (cancelled) return;

        setFrameAssetFilesByDevice((prev) => ({ ...prev, [deviceType]: frameFiles }));
        setSelectedFrameAssetFilesByDevice((prev) => {
          const currentSelection = prev[deviceType];
          const nextSelection =
            currentSelection && frameFiles.includes(currentSelection)
              ? currentSelection
              : frameFiles[0];

          const next = { ...prev };
          if (nextSelection) {
            next[deviceType] = nextSelection;
          } else {
            delete next[deviceType];
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setFrameAssetFilesByDevice((prev) => ({ ...prev, [deviceType]: [] }));
      } finally {
        if (!cancelled) {
          setFrameFilesLoadingByDevice((prev) => ({ ...prev, [deviceType]: false }));
        }
      }
    };

    Promise.all(selectedDevices.map((deviceType) => loadFrameFilesForDevice(deviceType))).catch(
      () => {}
    );

    return () => {
      cancelled = true;
    };
  }, [selectedDevices]);

  useEffect(() => {
    const generatePreview = async () => {
      if (!app || selectedDevices.length === 0) {
        setPreviewImage(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      const previewDevice = selectedDevices[0];
      const previewScreen = app.screens.find((screen) => screen.device_type === previewDevice);

      if (!previewScreen) {
        setPreviewImage(null);
        setPreviewError(null);
        setPreviewLoading(false);
        return;
      }

      const defaultCopy =
        copies[previewScreen.id]?.en ||
        copies[previewScreen.id]?.[Object.keys(copies[previewScreen.id] || {})[0]];

      if (!defaultCopy) {
        setPreviewError('Add at least one copy before generating preview.');
        setPreviewImage(null);
        setPreviewLoading(false);
        return;
      }

      const requestId = ++previewRequestIdRef.current;
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const imageResponse = await fetch(`/api/uploads/${previewScreen.screenshot_path}`);
        if (!imageResponse.ok) {
          throw new Error('Failed to load source screenshot');
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const screenshotBase64 = bufferToBase64(imageBuffer);
        const previewFrameMode = frameModesByDevice[previewDevice] || 'minimal';
        const previewFrameAssetFile =
          previewFrameMode === 'realistic'
            ? selectedFrameAssetFilesByDevice[previewDevice]
            : undefined;

        const previewResponse = await fetch('/api/templates/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot_base64: screenshotBase64,
            style: BACKGROUND_TEMPLATE_STYLE,
            template_background: templateBackground,
            device_type: previewDevice,
            title: defaultCopy.title,
            subtitle: defaultCopy.subtitle || '',
            frame_mode: previewFrameMode,
            frame_asset_file: previewFrameAssetFile,
          }),
        });

        if (!previewResponse.ok) {
          throw new Error('Failed to generate template preview');
        }

        const payload = await previewResponse.json();
        if (previewRequestIdRef.current !== requestId) {
          return;
        }
        setPreviewImage(`data:image/png;base64,${payload.data.image_base64}`);
      } catch (previewGenerationError) {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }
        setPreviewError(
          previewGenerationError instanceof Error
            ? previewGenerationError.message
            : 'Failed to generate preview'
        );
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setPreviewLoading(false);
        }
      }
    };

    generatePreview();
  }, [
    app,
    copies,
    selectedDevices,
    templateBackground,
    frameModesByDevice,
    selectedFrameAssetFilesByDevice,
  ]);

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

  const setDeviceFrameAssetFile = (deviceType: DeviceType, frameAssetFile: string) => {
    setSelectedFrameAssetFilesByDevice((prev) => ({ ...prev, [deviceType]: frameAssetFile }));
  };

  const selectSolidColor = (value: string) => {
    const normalized = normalizeHexColor(value);
    if (normalized) {
      setBackgroundMode('solid');
      setSolidColor(normalized);
    }
  };

  const setGradientStop = (key: 'from' | 'to', value: string) => {
    const normalized = normalizeHexColor(value);
    if (!normalized) {
      return;
    }
    if (key === 'from') {
      setGradientFrom(normalized);
      return;
    }
    setGradientTo(normalized);
  };

  const selectGradientPreset = (from: string, to: string) => {
    setBackgroundMode('gradient');
    setGradientFrom(from.toUpperCase());
    setGradientTo(to.toUpperCase());
  };

  const startGeneration = async () => {
    setGenerating(true);
    setError(null);

    try {
      const selectedDeviceFrameModes: FrameModesByDevice = {};
      const selectedDeviceFrameAssets: FrameAssetFilesByDevice = {};
      selectedDevices.forEach((deviceType) => {
        selectedDeviceFrameModes[deviceType] = frameModesByDevice[deviceType] || 'minimal';
        const selectedFrameAssetFile = selectedFrameAssetFilesByDevice[deviceType];
        if (selectedFrameAssetFile) {
          selectedDeviceFrameAssets[deviceType] = selectedFrameAssetFile;
        }
      });

      const response = await fetch(`/api/apps/${appId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          devices: selectedDevices,
          locales: selectedLocales,
          template_style: BACKGROUND_TEMPLATE_STYLE,
          template_background: templateBackground,
          frame_mode: 'minimal',
          frame_modes: selectedDeviceFrameModes,
          frame_asset_files:
            Object.keys(selectedDeviceFrameAssets).length > 0
              ? selectedDeviceFrameAssets
              : undefined,
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
        generationError instanceof Error ? generationError.message : 'Failed to start generation'
      );
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-6">
        <div className="space-y-4 max-w-3xl">
          <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="container mx-auto py-16 px-6 text-center">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold mb-2">App Not Found</h2>
        <p className="text-muted-foreground mb-6">The app you're looking for doesn't exist</p>
        <Link href="/">
          <Button>Back to Apps</Button>
        </Link>
      </div>
    );
  }

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
                  <button
                    type="button"
                    onClick={() => setDeviceFrameMode(deviceType, 'none')}
                    className={`rounded-lg border p-3 text-left transition-colors min-h-[172px] ${
                      (frameModesByDevice[deviceType] || 'minimal') === 'none'
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <FrameModePreview deviceType={deviceType} mode="none" />
                    <p className="font-medium text-sm">No Frame</p>
                    <p className="text-xs text-muted-foreground">
                      Screenshot only, no device bezel
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeviceFrameMode(deviceType, 'minimal')}
                    className={`rounded-lg border p-3 text-left transition-colors min-h-[172px] ${
                      (frameModesByDevice[deviceType] || 'minimal') === 'minimal'
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <FrameModePreview deviceType={deviceType} mode="minimal" />
                    <p className="font-medium text-sm">Minimal Frame</p>
                    <p className="text-xs text-muted-foreground">
                      Simple procedural device outline
                    </p>
                  </button>

                  {(frameAssetFilesByDevice[deviceType] || []).map((fileName) => {
                    const isSelected =
                      (frameModesByDevice[deviceType] || 'minimal') === 'realistic' &&
                      selectedFrameAssetFilesByDevice[deviceType] === fileName;

                    return (
                      <button
                        key={`${deviceType}-${fileName}`}
                        type="button"
                        onClick={() => {
                          setDeviceFrameMode(deviceType, 'realistic');
                          setDeviceFrameAssetFile(deviceType, fileName);
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors min-h-[172px] ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-input hover:bg-accent'
                        }`}
                      >
                        <FrameModePreview
                          deviceType={deviceType}
                          mode="realistic"
                          frameFile={fileName}
                        />
                        <p className="font-medium text-sm break-words">
                          {frameFileLabel(fileName)}
                        </p>
                        <p className="text-xs text-muted-foreground">Real device frame</p>
                      </button>
                    );
                  })}
                </div>
                {frameFilesLoadingByDevice[deviceType] && (
                  <p className="mt-2 text-xs text-muted-foreground">Loading frame options...</p>
                )}
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
            <CardTitle>4. Choose Template Background</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid max-w-sm grid-cols-2 gap-2">
              <Button
                type="button"
                variant={backgroundMode === 'solid' ? 'default' : 'outline'}
                onClick={() => setBackgroundMode('solid')}
              >
                Single Color
              </Button>
              <Button
                type="button"
                variant={backgroundMode === 'gradient' ? 'default' : 'outline'}
                onClick={() => setBackgroundMode('gradient')}
              >
                Gradient
              </Button>
            </div>

            {backgroundMode === 'gradient' && (
              <div className="rounded-xl border p-3">
                <div className="h-28 rounded-lg border" style={backgroundPreviewStyle} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Live background preview applied to template output
                </p>
              </div>
            )}

            {backgroundMode === 'solid' ? (
              <div className="space-y-3">
                <Label htmlFor="template-solid-color">Pick color</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="template-solid-color"
                    type="color"
                    value={solidColor}
                    onChange={(event) => selectSolidColor(event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                  />
                  <Input value={solidColor} readOnly className="max-w-[180px] font-mono" />
                </div>
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                  {SOLID_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => selectSolidColor(preset)}
                      className={`h-8 w-8 rounded border ${
                        solidColor === preset.toUpperCase()
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-input'
                      }`}
                      style={{ backgroundColor: preset }}
                      aria-label={`Use color ${preset}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-gradient-from">From</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-gradient-from"
                        type="color"
                        value={gradientFrom}
                        onChange={(event) => setGradientStop('from', event.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                      />
                      <Input value={gradientFrom} readOnly className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-gradient-to">To</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="template-gradient-to"
                        type="color"
                        value={gradientTo}
                        onChange={(event) => setGradientStop('to', event.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-1"
                      />
                      <Input value={gradientTo} readOnly className="font-mono" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected =
                      gradientFrom === preset.from.toUpperCase() &&
                      gradientTo === preset.to.toUpperCase();

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => selectGradientPreset(preset.from, preset.to)}
                        className={`overflow-hidden rounded-lg border text-left transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent'
                        }`}
                      >
                        <div
                          className="h-10"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${preset.from} 0%, ${preset.to} 100%)`,
                          }}
                        />
                        <p className="px-2 py-1 text-xs">{preset.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Preview (Default English Copy)</CardTitle>
          </CardHeader>
          <CardContent>
            {previewImage && (
              <div className="relative aspect-[9/16] max-w-xs mx-auto rounded-md border bg-muted">
                <Image
                  src={previewImage}
                  alt="Template preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
                {previewLoading && (
                  <div className="absolute inset-x-2 top-2 rounded bg-background/85 px-2 py-1 text-center text-xs text-muted-foreground backdrop-blur-sm">
                    Updating preview...
                  </div>
                )}
              </div>
            )}
            {!previewImage && previewLoading && (
              <p className="text-sm text-muted-foreground">Rendering preview...</p>
            )}
            {previewError && (
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
                  generating || selectedDevices.length === 0 || selectedLocales.length === 0
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
