// src/components/RelayCell.tsx
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatMs } from '@/domain/timing';
import { colors, SLOT_COLORS } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  teamName: string;
  slotIndex: 0 | 1 | 2 | 3;
  currentLegIndex: number;    // 0..legCount-1; capped at legCount-1 when finished
  legRunnerNames: string[];   // length === legCount, one name per leg by legIndex
  capturedAts: number[];      // all splits for this entry so far (ms epoch)
  startedAt: number;          // race.startedAt (ms epoch)
  elapsedMs: number;          // current elapsed from useRaceClock
  expectedLaps: number;       // e.g. 8 for 4×800
  legCount?: number;          // number of legs (default 4)
  onTap: () => void;
  onChangeLeg: () => void;
  finished: boolean;
};

export function RelayCell({
  teamName,
  slotIndex,
  currentLegIndex,
  legRunnerNames,
  capturedAts,
  startedAt,
  elapsedMs,
  expectedLaps,
  legCount = 4,
  onTap,
  onChangeLeg,
  finished,
}: Props) {
  const lapsPerLeg = Math.floor(expectedLaps / legCount);
  const legStartEpoch =
    currentLegIndex === 0 ? startedAt : capturedAts[currentLegIndex * lapsPerLeg - 1];
  const legElapsedMs = elapsedMs - (legStartEpoch - startedAt);
  const lapsInCurrentLeg = capturedAts.length - currentLegIndex * lapsPerLeg;

  const completedLegs = Array.from({ length: currentLegIndex }, (_, i) => {
    const legStart = i === 0 ? startedAt : capturedAts[i * lapsPerLeg - 1];
    const legEnd = capturedAts[(i + 1) * lapsPerLeg - 1];
    return { name: legRunnerNames[i] ?? '?', totalMs: legEnd - legStart };
  });

  const slotColor = SLOT_COLORS[slotIndex];

  const handlePress = () => {
    if (finished) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTap();
  };

  return (
    <TouchableOpacity
      style={[s.cell, { borderLeftColor: slotColor }, finished && s.cellFinished]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <Text style={s.headerText}>
          Leg {currentLegIndex + 1}/{legCount} · {teamName}
        </Text>
        <TouchableOpacity style={s.changeBtn} onPress={onChangeLeg} disabled={finished}>
          <Text style={s.changeBtnText}>Change</Text>
        </TouchableOpacity>
      </View>

      {finished ? (
        <Text style={s.done}>DONE</Text>
      ) : (
        <Text style={s.runnerName}>{legRunnerNames[currentLegIndex] ?? '?'}</Text>
      )}

      <View style={s.stats}>
        <View>
          <Text style={s.statLabel}>Leg time</Text>
          <Text style={s.legTime}>{formatMs(legElapsedMs)}</Text>
        </View>
        <View>
          <Text style={s.statLabel}>Laps in leg</Text>
          <Text style={s.statValue}>{lapsInCurrentLeg} / {lapsPerLeg}</Text>
        </View>
        <View>
          <Text style={s.statLabel}>Total</Text>
          <Text style={s.statValue}>{formatMs(elapsedMs)}</Text>
        </View>
      </View>

      {completedLegs.length > 0 && (
        <View style={s.chips}>
          {completedLegs.map((leg, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText}>
                L{i + 1} {leg.name} {formatMs(leg.totalMs)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    margin: 4,
    padding: 14,
  },
  cellFinished: { opacity: 0.55 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerText: {
    color: colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeBtnText: { color: colors.textSecondary, fontSize: 10 },
  runnerName: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginTop: 2 },
  done: { color: colors.textSecondary, fontSize: 18, fontWeight: '700', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 10 },
  statLabel: { color: colors.textDisabled, fontSize: 9, textTransform: 'uppercase' },
  legTime: { ...typography.splitTime, color: colors.warning },
  statValue: { ...typography.splitTime, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  chipText: { color: colors.textDisabled, fontSize: 9 },
});
