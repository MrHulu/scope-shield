import { create } from 'zustand';

/**
 * Three-way theme state. 'system' tracks the OS preference live; 'light' /
 * 'dark' force the chosen mode regardless of OS. Persisted to localStorage
 * so the picked mode survives reloads.
 *
 * Effective theme (the one actually applied to `data-theme`) is computed by
 * resolveTheme() — system → reads matchMedia.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'scope-shield-theme';

interface ThemeStore {
  preference: ThemePreference;
  effective: EffectiveTheme;
  setPreference: (pref: ThemePreference) => void;
}

function readStoredPreference(): ThemePreference {
  // Wrap in try/catch — node 22+ exposes a localStorage global that throws
  // on access without --localstorage-file, which trips up unit tests that
  // import this module before jsdom's overrides land.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* localStorage unavailable — fall through */
  }
  return 'system';
}

function readSystemPreference(): EffectiveTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(pref: ThemePreference): EffectiveTheme {
  return pref === 'system' ? readSystemPreference() : pref;
}

function applyToDom(theme: EffectiveTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

const initialPref = readStoredPreference();
const initialEffective = resolveTheme(initialPref);
applyToDom(initialEffective);

export const useThemeStore = create<ThemeStore>((set) => ({
  preference: initialPref,
  effective: initialEffective,
  setPreference: (pref) => {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* see readStoredPreference comment */
    }
    const effective = resolveTheme(pref);
    applyToDom(effective);
    set({ preference: pref, effective });
  },
}));

/**
 * Wire up matchMedia subscription so 'system' preference reacts live to OS
 * theme flips (macOS auto-dark at sunset, Windows night light, etc.).
 * Called once at App boot — see App.tsx.
 */
export function startSystemThemeListener(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const { preference } = useThemeStore.getState();
    if (preference !== 'system') return;
    const effective = resolveTheme(preference);
    applyToDom(effective);
    useThemeStore.setState({ effective });
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
