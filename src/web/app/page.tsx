import Link from 'next/link';
import { getAllApps, getScreensByAppId } from '@/lib/db';
import { AppsList } from '@/components/apps/AppsList';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const apps = getAllApps();

  // Enrich apps with screen count
  const appsWithScreens = apps.map((app) => ({
    ...app,
    screens: getScreensByAppId(app.id),
  }));

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Aperture Screenshot Manager</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage your app store screenshots with AI-powered localization
          </p>
        </div>
        <Link href="/apps/new">
          <Button size="lg">Create New App</Button>
        </Link>
      </div>

      <AppsList apps={appsWithScreens} />
    </div>
  );
}
