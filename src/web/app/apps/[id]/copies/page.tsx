'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import type { CopiesByScreenAndLocale, AppWithScreens } from '@/types';

export default function CopiesPage() {
  const params = useParams();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [copies, setCopies] = useState<CopiesByScreenAndLocale>({});
  const [selectedLocale, setSelectedLocale] = useState('en');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [appId]);

  const loadData = async () => {
    const [appRes, copiesRes] = await Promise.all([
      fetch(`/api/apps/${appId}`),
      fetch(`/api/apps/${appId}/copies`),
    ]);

    const appData = await appRes.json();
    const copiesData = await copiesRes.json();

    setApp(appData.data);
    setCopies(copiesData.data);
    setLoading(false);
  };

  const updateCopy = async (screenId: number, title: string, subtitle: string) => {
    await fetch(`/api/apps/${appId}/copies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [
          {
            screen_id: screenId,
            locale: selectedLocale,
            title,
            subtitle: subtitle || null,
          },
        ],
      }),
    });

    loadData();
  };

  if (loading) return <div className="container mx-auto py-8">Loading...</div>;
  if (!app) return <div className="container mx-auto py-8">App not found</div>;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Copies</h1>
        <p className="text-muted-foreground">{app.name}</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {SUPPORTED_LOCALES.slice(0, 10).map((locale) => (
          <Button
            key={locale.code}
            variant={selectedLocale === locale.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedLocale(locale.code)}
          >
            {locale.name}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {app.screens.map((screen) => {
          const copy = copies[screen.id]?.[selectedLocale];
          return (
            <Card key={screen.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Screen {screen.id}
                  <Badge variant="secondary">{screen.device_type}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title (max 30 chars)</Label>
                  <Input
                    defaultValue={copy?.title || ''}
                    maxLength={30}
                    onBlur={(e) => {
                      if (e.target.value !== copy?.title) {
                        updateCopy(screen.id, e.target.value, copy?.subtitle || '');
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtitle (max 80 chars, optional)</Label>
                  <Input
                    defaultValue={copy?.subtitle || ''}
                    maxLength={80}
                    onBlur={(e) => {
                      if (e.target.value !== copy?.subtitle) {
                        updateCopy(screen.id, copy?.title || '', e.target.value);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <Button size="lg">Generate with AI</Button>
      </div>
    </div>
  );
}
