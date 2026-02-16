'use client';

import { useAppTabs } from '@/components/layout/AppTabsContext';
import ScreenshotsTab from '@/components/apps/ScreenshotsTab';
import CopiesTab from './copies/page';
import GenerateTab from './generate/page';
import ResultsTab from './generations/page';

export default function AppPage() {
  const { activeTab } = useAppTabs();

  return (
    <div>
      {activeTab === 'screenshots' && <ScreenshotsTab />}
      {activeTab === 'copies' && <CopiesTab />}
      {activeTab === 'generate' && <GenerateTab />}
      {activeTab === 'results' && <ResultsTab />}
    </div>
  );
}
