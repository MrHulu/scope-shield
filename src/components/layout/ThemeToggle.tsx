import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '../../stores/themeStore';

const OPTIONS: Array<{ value: ThemePreference; icon: typeof Sun; label: string }> = [
  { value: 'light', icon: Sun, label: '浅色' },
  { value: 'system', icon: Monitor, label: '跟随系统' },
  { value: 'dark', icon: Moon, label: '深色' },
];

/**
 * Three-state segmented toggle for theme preference. Lives in the sidebar
 * footer so it's discoverable but out of the way.
 */
export function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-gray-100/60"
      role="radiogroup"
      aria-label="主题"
      data-testid="theme-toggle"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            data-testid={`theme-option-${value}`}
            data-active={active ? 'true' : undefined}
            onClick={() => setPreference(value)}
            className={`flex-1 flex items-center justify-center py-1 rounded-md transition-colors ${
              active
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={label}
          >
            <Icon size={12} />
          </button>
        );
      })}
    </div>
  );
}
