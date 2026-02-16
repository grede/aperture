'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import type { CopiesByScreenAndLocale, AppWithScreens } from '@/types';

type DraftCopy = { title: string; subtitle: string };

function localeLabel(code: string): string {
  return SUPPORTED_LOCALES.find((locale) => locale.code === code)?.name || code;
}

function collectLocaleCodes(copies: CopiesByScreenAndLocale): string[] {
  const localeSet = new Set<string>();

  Object.values(copies).forEach((byLocale) => {
    Object.keys(byLocale).forEach((localeCode) => localeSet.add(localeCode));
  });

  return Array.from(localeSet);
}

export default function CopiesPage() {
  const params = useParams();
  const appId = parseInt(params.id as string, 10);

  const [app, setApp] = useState<AppWithScreens | null>(null);
  const [copies, setCopies] = useState<CopiesByScreenAndLocale>({});
  const [drafts, setDrafts] = useState<Record<number, DraftCopy>>({});
  const [selectedLocale, setSelectedLocale] = useState('en');
  const [newLocaleCode, setNewLocaleCode] = useState('de');
  const [aiTargetLocales, setAiTargetLocales] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [appId]);

  useEffect(() => {
    if (!app) return;

    const nextDrafts: Record<number, DraftCopy> = {};
    for (const screen of app.screens) {
      const existingCopy = copies[screen.id]?.[selectedLocale];
      nextDrafts[screen.id] = {
        title: existingCopy?.title || '',
        subtitle: existingCopy?.subtitle || '',
      };
    }
    setDrafts(nextDrafts);
  }, [app, copies, selectedLocale]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);

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
      const loadedCopies = copiesPayload.data as CopiesByScreenAndLocale;

      setApp(appPayload.data);
      setCopies(loadedCopies);

      const localeCodes = collectLocaleCodes(loadedCopies);
      if (!localeCodes.includes(selectedLocale)) {
        setSelectedLocale(localeCodes.includes('en') ? 'en' : localeCodes[0] || 'en');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load copies');
    } finally {
      setLoading(false);
    }
  };

  const availableLocaleCodes = useMemo(() => {
    const localeCodes = new Set<string>(collectLocaleCodes(copies));
    localeCodes.add('en');
    localeCodes.add(selectedLocale);
    return Array.from(localeCodes).sort((a, b) =>
      localeLabel(a).localeCompare(localeLabel(b))
    );
  }, [copies, selectedLocale]);

  const selectableNewLocales = useMemo(
    () =>
      SUPPORTED_LOCALES.filter(
        (locale) => !availableLocaleCodes.includes(locale.code)
      ),
    [availableLocaleCodes]
  );

  useEffect(() => {
    if (selectableNewLocales.length > 0) {
      setNewLocaleCode(selectableNewLocales[0].code);
    }
  }, [selectableNewLocales]);

  const updateDraft = (screenId: number, updates: Partial<DraftCopy>) => {
    setDrafts((prev) => ({
      ...prev,
      [screenId]: {
        title: prev[screenId]?.title || '',
        subtitle: prev[screenId]?.subtitle || '',
        ...updates,
      },
    }));
  };

  const saveAllCopies = async () => {
    if (!app) return;

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const updates = app.screens.map((screen) => ({
        screen_id: screen.id,
        locale: selectedLocale,
        title: drafts[screen.id]?.title?.trim() || '',
        subtitle: drafts[screen.id]?.subtitle?.trim() || null,
      }));

      if (updates.some((update) => update.title.length === 0)) {
        throw new Error('All titles are required');
      }

      const response = await fetch(`/api/apps/${appId}/copies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error('Failed to save copies');
      }

      setStatusMessage(`Saved ${updates.length} copy item(s) for ${localeLabel(selectedLocale)}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save copies');
    } finally {
      setSaving(false);
    }
  };

  const toggleAiTargetLocale = (localeCode: string) => {
    setAiTargetLocales((prev) =>
      prev.includes(localeCode)
        ? prev.filter((code) => code !== localeCode)
        : [...prev, localeCode]
    );
  };

  const generateCopiesWithAi = async () => {
    if (!app) return;

    if (aiTargetLocales.length === 0) {
      setError('Select at least one target language for AI generation');
      return;
    }

    setGeneratingAi(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/copies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: app.id,
          app_description: app.description,
          source_locale: 'en',
          target_locales: aiTargetLocales,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to generate copies with AI');
      }

      setStatusMessage(
        `Generated copies for ${aiTargetLocales.length} locale(s) from English default copy.`
      );
      setSelectedLocale(aiTargetLocales[0]);
      setAiTargetLocales([]);
      await loadData();
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate copies with AI'
      );
    } finally {
      setGeneratingAi(false);
    }
  };

  if (loading) return <div className="container mx-auto py-8">Loading...</div>;
  if (!app) return <div className="container mx-auto py-8">App not found</div>;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Copies</h1>
        <p className="text-muted-foreground">{app.name}</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Language Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {availableLocaleCodes.map((localeCode) => (
              <Button
                key={localeCode}
                variant={selectedLocale === localeCode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedLocale(localeCode)}
              >
                {localeLabel(localeCode)}
              </Button>
            ))}
          </div>

          {selectableNewLocales.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-full max-w-xs space-y-2">
                <Label>Add Locale</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newLocaleCode}
                  onChange={(event) => setNewLocaleCode(event.target.value)}
                >
                  {selectableNewLocales.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedLocale(newLocaleCode)}
              >
                Add Locale
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {app.screens.map((screen, index) => (
          <Card key={screen.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Screen {index + 1}
                <Badge variant="secondary">{screen.device_type}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={drafts[screen.id]?.title || ''}
                  onChange={(event) =>
                    updateDraft(screen.id, { title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Subtitle (optional)</Label>
                <Input
                  value={drafts[screen.id]?.subtitle || ''}
                  onChange={(event) =>
                    updateDraft(screen.id, { subtitle: event.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Button size="lg" onClick={saveAllCopies} disabled={saving}>
          {saving ? 'Saving...' : `Save ${localeLabel(selectedLocale)} Copies`}
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Generate Copies With AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Uses English (`en`) as source and generates localized variants for selected languages.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {SUPPORTED_LOCALES.filter((locale) => locale.code !== 'en').map((locale) => (
              <button
                key={locale.code}
                type="button"
                onClick={() => toggleAiTargetLocale(locale.code)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  aiTargetLocales.includes(locale.code)
                    ? 'border-primary bg-primary/10'
                    : 'border-input hover:bg-accent'
                }`}
              >
                {locale.name}
              </button>
            ))}
          </div>
          <Button onClick={generateCopiesWithAi} disabled={generatingAi}>
            {generatingAi ? 'Generating...' : 'Generate with AI'}
          </Button>
        </CardContent>
      </Card>

      {statusMessage && (
        <p className="mt-4 text-sm text-green-700" role="status">
          {statusMessage}
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
