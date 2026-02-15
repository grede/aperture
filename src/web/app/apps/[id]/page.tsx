import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAppWithScreens } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ScreenCard } from '@/components/screens/ScreenCard';

export const dynamic = 'force-dynamic';

export default function AppDetailsPage({ params }: { params: { id: string } }) {
  const appId = parseInt(params.id, 10);
  const app = getAppWithScreens(appId);

  if (!app) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold">{app.name}</h1>
            <p className="text-muted-foreground mt-2">{app.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/apps/${app.id}/copies`}>
              <Button variant="outline">Manage Copies</Button>
            </Link>
            <Link href={`/apps/${app.id}/generate`}>
              <Button>Generate Screenshots</Button>
            </Link>
          </div>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Screens</CardTitle>
          <CardDescription>
            Upload screenshots for different devices. Add titles and subtitles for each screen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {app.screens.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No screens yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first screenshot to get started
              </p>
              <Button className="mt-4" variant="outline">
                Upload Screenshot
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {app.screens.map((screen) => (
                <ScreenCard key={screen.id} screen={screen} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
