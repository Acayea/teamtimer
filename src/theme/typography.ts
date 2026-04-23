// src/theme/typography.ts
import { Platform } from 'react-native';

export const monoFont = Platform.select({
  ios: 'Courier New',
  android: 'monospace',
  default: 'monospace',
}) ?? 'monospace';

export const typography = {
  raceClock: { fontFamily: monoFont, fontSize: 48, fontWeight: '700' as const, letterSpacing: 2 },
  lapTime:   { fontFamily: monoFont, fontSize: 28, fontWeight: '600' as const },
  splitTime: { fontFamily: monoFont, fontSize: 18, fontWeight: '400' as const },
  delta:     { fontFamily: monoFont, fontSize: 16, fontWeight: '500' as const },
  label:     { fontSize: 14, fontWeight: '500' as const },
  caption:   { fontSize: 12, fontWeight: '400' as const },
} as const;
