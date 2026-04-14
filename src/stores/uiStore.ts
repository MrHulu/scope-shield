import { create } from 'zustand';

type ChartTab = 'simple' | 'detail';

interface UIStore {
  currentProjectId: string | null;
  lastVisitedProjectId: string | null;
  chartTab: ChartTab;
  setCurrentProjectId: (id: string | null) => void;
  setChartTab: (tab: ChartTab) => void;
}

const LAST_VISITED_KEY = 'scope-shield-last-project';

export const useUIStore = create<UIStore>((set) => ({
  currentProjectId: null,
  lastVisitedProjectId: localStorage.getItem(LAST_VISITED_KEY),
  chartTab: 'simple',

  setCurrentProjectId: (id) => {
    if (id) localStorage.setItem(LAST_VISITED_KEY, id);
    set({ currentProjectId: id });
  },

  setChartTab: (tab) => set({ chartTab: tab }),
}));
