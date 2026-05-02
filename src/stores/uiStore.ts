import { create } from 'zustand';

type ChartTab = 'simple' | 'detail';

interface UIStore {
  currentProjectId: string | null;
  lastVisitedProjectId: string | null;
  chartTab: ChartTab;
  /** W-bug-fix-2: desktop sidebar collapsed → reclaim ~240px for the chart. */
  sidebarCollapsed: boolean;
  setCurrentProjectId: (id: string | null) => void;
  setChartTab: (tab: ChartTab) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

const LAST_VISITED_KEY = 'scope-shield-last-project';
const SIDEBAR_COLLAPSED_KEY = 'scope-shield-sidebar-collapsed';

export const useUIStore = create<UIStore>((set) => ({
  currentProjectId: null,
  lastVisitedProjectId: localStorage.getItem(LAST_VISITED_KEY),
  chartTab: 'simple',
  sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',

  setCurrentProjectId: (id) => {
    if (id) localStorage.setItem(LAST_VISITED_KEY, id);
    set({ currentProjectId: id });
  },

  setChartTab: (tab) => set({ chartTab: tab }),
  setSidebarCollapsed: (v) => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '1' : '0');
    set({ sidebarCollapsed: v });
  },
}));
