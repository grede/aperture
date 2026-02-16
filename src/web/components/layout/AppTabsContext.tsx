'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type TabValue = 'screenshots' | 'copies' | 'generate' | 'results';

interface AppTabsContextType {
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;
}

const AppTabsContext = createContext<AppTabsContextType | null>(null);

export function AppTabsProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabValue>('screenshots');

  return (
    <AppTabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </AppTabsContext.Provider>
  );
}

export function useAppTabs() {
  const context = useContext(AppTabsContext);
  if (!context) {
    throw new Error('useAppTabs must be used within AppTabsProvider');
  }
  return context;
}
