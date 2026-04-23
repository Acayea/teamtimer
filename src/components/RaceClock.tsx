// src/components/RaceClock.tsx
import { Text, StyleSheet } from 'react-native';
import { formatMs } from '@/domain/timing';
import { typography } from '@/theme/typography';
import { colors } from '@/theme/colors';

interface Props {
  elapsedMs: number;
}

export function RaceClock({ elapsedMs }: Props) {
  return <Text style={s.clock}>{formatMs(elapsedMs)}</Text>;
}

const s = StyleSheet.create({
  clock: {
    ...typography.raceClock,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
