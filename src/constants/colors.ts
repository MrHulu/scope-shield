import type { Role } from '../types';

// App UI colors
export const APP_ROLE_COLORS: Record<Role, string> = {
  pm: '#DC2626',
  leader: '#D97706',
  qa: '#7C3AED',
  other: '#6B7280',
};

export const APP_COLORS = {
  plan: '#2563EB',
  save: '#059669',
  newRequirement: '#5B21B6',
  supplement: '#E11D48',
} as const;

// Export (Apple style) colors
export const EXPORT_ROLE_COLORS: Record<Role, string> = {
  pm: '#FF3B30',
  leader: '#FF9500',
  qa: '#AF52DE',
  other: '#8E8E93',
};

export const EXPORT_COLORS = {
  plan: '#007AFF',
  save: '#34C759',
  newRequirement: '#5856D6',
  supplement: '#FF2D55',
} as const;
