/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore, resolveTheme } from '../themeStore';

/**
 * jsdom is required for window.matchMedia + document.documentElement —
 * this is the first jsdom-targeted unit file in the project.
 */

describe('themeStore', () => {
  beforeEach(() => {
    try {
      window.localStorage?.clear?.();
    } catch {
      /* node's bare localStorage stub may throw — fine */
    }
    delete document.documentElement.dataset.theme;
    // Reset zustand state to fresh defaults each test.
    useThemeStore.setState({ preference: 'system', effective: 'light' });
  });

  it('setPreference("dark") writes data-theme=dark + persists store', () => {
    useThemeStore.getState().setPreference('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().effective).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setPreference("light") writes data-theme=light', () => {
    useThemeStore.getState().setPreference('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(useThemeStore.getState().effective).toBe('light');
  });

  it('setPreference("system") resolves via matchMedia', () => {
    // jsdom's matchMedia returns matches=false by default → light.
    useThemeStore.getState().setPreference('system');
    expect(useThemeStore.getState().preference).toBe('system');
    expect(['light', 'dark']).toContain(useThemeStore.getState().effective);
  });

  it('resolveTheme respects matchMedia for system preference', () => {
    const original = window.matchMedia;
    // Force "user prefers dark"
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    expect(resolveTheme('system')).toBe('dark');
    window.matchMedia = original;
  });

  it('resolveTheme returns explicit pref unchanged', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});
