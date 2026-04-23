// src/theme/colors.ts

// Per-slot colors: one distinct high-contrast color per athlete position
export const SLOT_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308'] as const;

export const colors = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#2E2E2E',
  textPrimary: '#F5F5F5',
  textSecondary: '#A3A3A3',
  textDisabled: '#525252',
  accent: '#6366F1',        // indigo — buttons, active states
  success: '#22C55E',       // athlete ahead of target
  danger: '#EF4444',        // athlete behind target
  warning: '#EAB308',       // close to target (within 0.5s)
  neutral: '#737373',       // no target set
  slot: SLOT_COLORS,
} as const;

export type Colors = typeof colors;
