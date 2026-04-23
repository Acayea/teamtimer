// src/components/AthleteCell.tsx
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  formatMs,
  formatDeltaMs,
  lapTimeMs,
  cumulativeMs,
  deltaMs,
} from '@/domain/timing';
import { colors, SLOT_COLORS } from '@/theme/colors';
import { typography } from '@/theme/typography';

interface Props {
  name: string;
  slotIndex: 0 | 1 | 2 | 3;
  lapIndex: number;        // number of laps completed so far
  expectedLaps: number;
  capturedAts: number[];   // ms epoch for each completed lap
  startedAt: number;
  targetCumulativeMs?: number[];
  onTap: () => void;
  finished: boolean;
}

export function AthleteCell({
  name,
  slotIndex,
  lapIndex,
  expectedLaps,
  capturedAts,
  startedAt,
  targetCumulativeMs,
  onTap,
  finished,
}: Props) {
  const slotColor = SLOT_COLORS[slotIndex];

  const lastLapMs =
    lapIndex > 0 ? lapTimeMs(capturedAts, lapIndex - 1, startedAt) : null;
  const cumMs =
    lapIndex > 0 ? cumulativeMs(capturedAts, lapIndex - 1, startedAt) : null;
  const delta =
    lapIndex > 0 && targetCumulativeMs
      ? deltaMs(capturedAts, lapIndex - 1, startedAt, targetCumulativeMs)
      : null;

  const deltaColor =
    delta === null
      ? colors.neutral
      : Math.abs(delta) <= 500
      ? colors.warning
      : delta < 0
      ? colors.success
      : colors.danger;

  const handlePress = () => {
    if (finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTap();
  };

  return (
    <TouchableOpacity
      style={[s.cell, { borderColor: slotColor }, finished && s.cellFinished]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible
      accessibilityLabel={`${name}, lap ${lapIndex} of ${expectedLaps}. Tap to record next lap.`}
    >
      <View style={[s.colorBar, { backgroundColor: slotColor }]} />
      <View style={s.body}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.progress}>Lap {lapIndex} / {expectedLaps}</Text>
        {lastLapMs !== null && (
          <Text style={s.lapTime}>{formatMs(lastLapMs)}</Text>
        )}
        {cumMs !== null && (
          <Text style={s.cumTime}>{formatMs(cumMs)}</Text>
        )}
        {delta !== null && (
          <Text style={[s.delta, { color: deltaColor }]}>{formatDeltaMs(delta)}</Text>
        )}
        {finished && <Text style={[s.done, { color: slotColor }]}>DONE</Text>}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    margin: 4,
  },
  cellFinished: { opacity: 0.55 },
  colorBar: { height: 4, width: '100%' },
  body: { padding: 12 },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  progress: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  lapTime: { ...typography.lapTime, color: colors.textPrimary, marginTop: 6 },
  cumTime: { ...typography.splitTime, color: colors.textSecondary, marginTop: 2 },
  delta: { ...typography.delta, marginTop: 4 },
  done: { fontSize: 13, fontWeight: '700', marginTop: 6, letterSpacing: 1 },
});
