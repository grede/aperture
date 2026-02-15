import Link from 'next/link';
import { Plus } from 'lucide-react';
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
    <div>
      {/* Minimal Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Apps</h1>
          <p className="text-sm text-muted-foreground">
            Manage your app store screenshot projects
          </p>
        </div>
        <Link href="/apps/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New App
          </Button>
        </Link>
      </div>

      {/* Apps List or Empty State */}
      {apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <h2 className="text-lg font-medium mb-2">No apps yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Get started by creating your first app
          </p>
          <Link href="/apps/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First App
            </Button>
          </Link>
        </div>
      ) : (
        <AppsList apps={appsWithScreens} />
      )}
    </div>
  );
}
