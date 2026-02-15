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
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="border-b bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
              AI-Powered Screenshot Automation
            </div>
            <h1 className="mb-4 text-5xl font-bold tracking-tight">
              Create App Store Screenshots in 30+ Languages
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              Upload once, localize everywhere. Generate professional app store screenshots
              with AI-powered translations and beautiful templates.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/apps/new">
                <Button size="lg">
                  Create New App
                </Button>
              </Link>
              {apps.length > 0 && (
                <Button size="lg" variant="outline" asChild>
                  <a href="#apps">View My Apps ({apps.length})</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apps Section */}
      <div id="apps" className="container mx-auto px-6 py-12" style={{ scrollMarginTop: '2rem' }}>
        {apps.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-6 text-6xl">📱</div>
            <h2 className="text-2xl font-bold mb-2">No apps yet</h2>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first app
            </p>
            <Link href="/apps/new">
              <Button size="lg">Create Your First App</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Your Apps</h2>
              <p className="text-muted-foreground">
                Manage your app store screenshot projects
              </p>
            </div>
            <AppsList apps={appsWithScreens} />
          </>
        )}
      </div>
    </div>
  );
}
