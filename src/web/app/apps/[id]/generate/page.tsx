'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DEVICE_TYPES,
  TEMPLATE_STYLES,
  TEMPLATE_STYLE_INFO,
  FRAME_MODES,
  SUPPORTED_LOCALES,
} from '@/lib/constants';
import type { AppWithScreens } from '@/types';

export default function GeneratePage() {
  const params = useParams();
  const router = useRouter();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [selectedLocales, setSelectedLocales] = useState<string[]>(['en']);
  const [templateStyle, setTemplateStyle] = useState('modern');
  const [frameMode, setFrameMode] = useState('minimal');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadApp();
  }, [appId]);

  const loadApp = async () => {
    const response = await fetch(`/api/apps/${appId}`);
    const payload = (await response.json()) as { data: AppWithScreens };
    setApp(payload.data);

    // Pre-select devices that have screens
    const deviceTypes = new Set(
      payload.data.screens.map((screen) => screen.device_type)
    );
    setSelectedDevices(Array.from(deviceTypes));

    setLoading(false);
  };

  const startGeneration = async () => {
    setGenerating(true);

    const response = await fetch(`/api/apps/${appId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        devices: selectedDevices,
        locales: selectedLocales,
        template_style: templateStyle,
        frame_mode: frameMode,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      router.push(`/apps/${appId}/generations/${data.data.generation_id}`);
    } else {
      alert('Failed to start generation');
      setGenerating(false);
    }
  };

  if (loading) return <div className="container mx-auto py-8">Loading...</div>;
  if (!app) return <div className="container mx-auto py-8">App not found</div>;

  const availableDevices = Array.from(
    new Set(app.screens.map((s) => s.device_type))
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Generate Screenshots</h1>
        <p className="text-muted-foreground">{app.name}</p>
      </div>

      <div className="space-y-6">
        {/* Device Selection */}
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
                  onClick={() => {
                    if (selectedDevices.includes(device)) {
                      setSelectedDevices(selectedDevices.filter((d) => d !== device));
                    } else {
                      setSelectedDevices([...selectedDevices, device]);
                    }
                  }}
                >
                  {device}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Frame Mode */}
        <Card>
          <CardHeader>
            <CardTitle>2. Choose Frame Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {FRAME_MODES.map((mode) => (
                <Button
                  key={mode.value}
                  variant={frameMode === mode.value ? 'default' : 'outline'}
                  className="h-auto flex-col items-start p-4"
                  onClick={() => setFrameMode(mode.value)}
                >
                  <div className="font-semibold mb-1">{mode.label}</div>
                  <div className="text-xs text-left">{mode.description}</div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Locale Selection */}
        <Card>
          <CardHeader>
            <CardTitle>3. Select Languages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LOCALES.slice(0, 10).map((locale) => (
                <Button
                  key={locale.code}
                  size="sm"
                  variant={selectedLocales.includes(locale.code) ? 'default' : 'outline'}
                  onClick={() => {
                    if (selectedLocales.includes(locale.code)) {
                      setSelectedLocales(selectedLocales.filter((l) => l !== locale.code));
                    } else {
                      setSelectedLocales([...selectedLocales, locale.code]);
                    }
                  }}
                >
                  {locale.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Template Style */}
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
                  <div className="font-semibold mb-1">
                    {TEMPLATE_STYLE_INFO[style].name}
                  </div>
                  <div className="text-xs text-left">
                    {TEMPLATE_STYLE_INFO[style].description}
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedDevices.length} device(s) × {selectedLocales.length} locale(s) ={' '}
                {selectedDevices.length * selectedLocales.length * app.screens.length} images
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
