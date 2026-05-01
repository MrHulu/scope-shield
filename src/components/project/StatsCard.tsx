import { useEffect, useRef, useState } from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  /** Tailwind text color class for the value, e.g. 'text-red-600'. */
  color?: string;
  /**
   * Layout / type scale.
   * - 'hero'    : double-width, value at clamp(36px,4vw,48px) — the headline number
   * - 'default' : standard stat card (text-2xl)
   * - 'chip'    : compact pill for sidebar or in-line use (text-base)
   */
  variant?: 'hero' | 'default' | 'chip';
  /** One-liner explainer below the value (hero variant only). */
  caption?: string;
  /** Stable testid for e2e font-size assertions. */
  testid?: string;
}

/**
 * Pulses the value when it changes — anchors the user's eye on the number
 * that just moved, addressing W1 of the secretary walkthrough where stat
 * updates went unnoticed.
 */
function useValuePulse(value: string | number): boolean {
  const prev = useRef(value);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 300);
    return () => clearTimeout(t);
  }, [value]);
  return pulsing;
}

export function StatsCard({
  label,
  value,
  suffix,
  color,
  variant = 'default',
  caption,
  testid,
}: StatsCardProps) {
  const valueColor = color ?? 'text-gray-900';
  const pulse = useValuePulse(value);
  const pulseClass = pulse ? 'stat-update-pulse' : '';

  if (variant === 'hero') {
    return (
      <div
        data-testid={testid}
        className="glass-panel glass-panel-hover rounded-2xl p-6 flex-[1.5] min-w-0"
      >
        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
          {label}
        </p>
        <p
          className={`font-semibold leading-none ${valueColor} ${pulseClass}`}
          style={{ fontSize: 'var(--font-size-hero)', display: 'inline-block', transformOrigin: 'left center' }}
        >
          {value}
          {suffix && (
            <span className="text-base font-normal text-gray-500 ml-1">{suffix}</span>
          )}
        </p>
        {caption && (
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{caption}</p>
        )}
      </div>
    );
  }

  if (variant === 'chip') {
    return (
      <div
        data-testid={testid}
        className="glass-panel rounded-xl px-3 py-2 flex items-center gap-2 min-w-0"
      >
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`text-base font-semibold ${valueColor} ${pulseClass}`} style={{ display: 'inline-block' }}>
          {value}
          {suffix && <span className="text-xs font-normal text-gray-500 ml-0.5">{suffix}</span>}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid={testid}
      className="glass-panel glass-panel-hover rounded-xl p-4 flex-1 min-w-0"
    >
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-2xl font-semibold ${valueColor} ${pulseClass}`}
        style={{ fontSize: 'var(--font-size-stat)', display: 'inline-block', transformOrigin: 'left center' }}
      >
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}
