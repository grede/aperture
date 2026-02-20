'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TabConfig {
  label: string;
  value: 'screenshots' | 'copies' | 'generate' | 'results';
}

type TabValue = TabConfig['value'];

export function AppTabs() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const appId = params?.id as string | undefined;

  // Only show tabs when viewing an app
  if (!appId) return null;

  const tabs: TabConfig[] = [
    { label: 'Screenshots', value: 'screenshots' },
    { label: 'Copies', value: 'copies' },
    { label: 'Generate', value: 'generate' },
    { label: 'Results', value: 'results' },
  ];

  const appRootPath = `/apps/${appId}`;
  const tabByPathPrefix: Record<string, TabValue> = {
    '/copies': 'copies',
    '/generate': 'generate',
    '/generations': 'results',
  };

  const activeTab: TabValue =
    Object.entries(tabByPathPrefix).find(([pathPrefix]) =>
      pathname.startsWith(`${appRootPath}${pathPrefix}`)
    )?.[1] || 'screenshots';

  const tabRoutes: Record<TabValue, string> = {
    screenshots: appRootPath,
    copies: `${appRootPath}/copies`,
    generate: `${appRootPath}/generate`,
    results: `${appRootPath}/generations`,
  };

  const onTabChange = (value: string) => {
    const tab = value as TabValue;
    const nextPath = tabRoutes[tab];
    if (nextPath && nextPath !== pathname) {
      router.push(nextPath);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
