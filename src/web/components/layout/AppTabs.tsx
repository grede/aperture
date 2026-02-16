'use client';

import { useParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppTabs } from './AppTabsContext';

interface TabConfig {
  label: string;
  value: 'screenshots' | 'copies' | 'generate' | 'results';
}

export function AppTabs() {
  const params = useParams();
  const appId = params?.id as string | undefined;
  const { activeTab, setActiveTab } = useAppTabs();

  // Only show tabs when viewing an app
  if (!appId) return null;

  const tabs: TabConfig[] = [
    { label: 'Screenshots', value: 'screenshots' },
    { label: 'Copies', value: 'copies' },
    { label: 'Generate', value: 'generate' },
    { label: 'Results', value: 'results' },
  ];

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
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
