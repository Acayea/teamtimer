// app/race/[id]/review.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRace, getRaceEntries, discardRace, getRelayLegsForEntry } from '@/repos/races';
import { getSplitsForEntry, getTargetsForEntry, editSplit } from '@/repos/splits';
import { getAthlete } from '@/repos/athletes';
import type { Race, RaceEntry, Split, TargetSplit, Athlete, RelayLeg } from '@/db/schema';
import {
  formatMs,
  formatDeltaMs,
  lapTimeMs,
  cumulativeMs,
  deltaMs,
} from '@/domain/timing';
import { colors, SLOT_COLORS } from '@/theme/colors';

type Row = {
  entry: RaceEntry;
  athlete: Athlete | null;
  splits: Split[];
  targets: TargetSplit[];
  relayLegs?: RelayLeg[];
  legRunnerNames?: string[];
};

export default function RaceReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [race, setRace]     = useState<Race | null>(null);
  const [rows, setRows]     = useState<Row[]>([]);
  const [editing, setEditing] = useState<{ split: Split; value: string } | null>(null);

  const load = useCallback(async () => {
    const r = await getRace(id);
    if (!r) return;
    setRace(r);
    const entries = await getRaceEntries(id);
    const loaded = await Promise.all(
      entries.map(async (entry) => {
        const [splitsData, targets] = await Promise.all([
          getSplitsForEntry(entry.id),
          getTargetsForEntry(entry.id),
        ]);
        const athlete = entry.athleteId ? await getAthlete(entry.athleteId) : null;

        if (r.kind === 'relay') {
          const legs = await getRelayLegsForEntry(entry.id);
          const legRunnerNames = await Promise.all(
            legs.map(async (leg) => {
              const a = await getAthlete(leg.athleteId);
              return a?.name ?? '?';
            }),
          );
          return { entry, athlete: athlete ?? null, splits: splitsData, targets, relayLegs: legs, legRunnerNames };
        }

        return { entry, athlete: athlete ?? null, splits: splitsData, targets };
      }),
    );
    setRows(loaded.sort((a, b) => a.entry.slotIndex - b.entry.slotIndex));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onDiscard = () => {
    Alert.alert(
      'Discard race?',
      'This race will be marked discarded and hidden from history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await discardRace(id);
            router.replace('/');
          },
        },
      ],
    );
  };

  const onSaveEdit = async () => {
    if (!editing || !race?.startedAt) return;
    const match = editing.value.match(/^(\d+):(\d{2})\.(\d{2})$/);
    if (!match) {
      Alert.alert('Invalid format', 'Enter time as M:SS.hh (e.g. 1:02.50)');
      return;
    }
    const ms =
      (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000 +
      parseInt(match[3]) * 10;
    const newCapturedAt = race.startedAt + ms;
    await editSplit(editing.split.id, newCapturedAt);
    setEditing(null);
    await load();
  };

  if (!race) return null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>
        {race.distanceM}m · {race.expectedLaps} Laps
      </Text>

      {rows.map((row) => {
        const slotColor = SLOT_COLORS[row.entry.slotIndex as 0 | 1 | 2 | 3];
        const capturedAts = row.splits.map((sp) => sp.capturedAt);
        const targetMs = row.targets.map((t) => t.targetMs);
        const hasTargets = targetMs.length > 0;
        const startedAt = race.startedAt ?? 0;

        return (
          <View key={row.entry.id} style={[s.card, { borderLeftColor: slotColor }]}>
            <Text style={[s.cardName, { color: slotColor }]}>
              {row.athlete?.name ?? row.entry.teamName ?? '?'}
            </Text>
            {race.kind === 'relay' && row.relayLegs && row.legRunnerNames
              ? (() => {
                  const legCount = row.relayLegs.length;
                  const lapsPerLeg = Math.floor(race.expectedLaps / legCount);
                  return row.relayLegs.map((leg, legIdx) => {
                    const legSplits = row.splits.slice(
                      legIdx * lapsPerLeg,
                      (legIdx + 1) * lapsPerLeg,
                    );
                    if (legSplits.length === 0) return null;
                    const legStartAt =
                      legIdx === 0
                        ? startedAt
                        : capturedAts[legIdx * lapsPerLeg - 1];
                    const legEndAt: number | undefined = capturedAts[(legIdx + 1) * lapsPerLeg - 1];
                    const legMs = legEndAt !== undefined ? legEndAt - legStartAt : null;
                    return (
                      <View key={leg.id}>
                        <View style={s.legDivider}>
                          <Text style={s.legDividerText}>
                            {`Leg ${legIdx + 1} · ${row.legRunnerNames![legIdx] ?? '?'}${legMs !== null ? ` · ${formatMs(legMs)}` : ''}`}
                          </Text>
                        </View>
                        {legSplits.map((sp, splitIdxInLeg) => {
                          const globalLapIdx = legIdx * lapsPerLeg + splitIdxInLeg;
                          const lapMs = lapTimeMs(capturedAts, globalLapIdx, startedAt);
                          const cumMs = cumulativeMs(capturedAts, globalLapIdx, startedAt);
                          const delta = hasTargets
                            ? deltaMs(capturedAts, globalLapIdx, startedAt, targetMs)
                            : null;
                          const deltaColor =
                            delta === null
                              ? colors.neutral
                              : delta < 0
                              ? colors.success
                              : colors.danger;
                          return (
                            <TouchableOpacity
                              key={sp.id}
                              style={s.splitRow}
                              onPress={() =>
                                setEditing({ split: sp, value: formatMs(cumMs) })
                              }
                            >
                              <Text style={s.lapNum}>Lap {globalLapIdx + 1}</Text>
                              <Text style={s.lapMs}>{formatMs(lapMs)}</Text>
                              <Text style={s.cumMs}>{formatMs(cumMs)}</Text>
                              {delta !== null && (
                                <Text style={[s.delta, { color: deltaColor }]}>
                                  {formatDeltaMs(delta)}
                                </Text>
                              )}
                              {sp.edited && <Text style={s.editedTag}>edited</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  });
                })()
              : row.splits.map((sp, lapIdx) => {
                  const lapMs = lapTimeMs(capturedAts, lapIdx, startedAt);
                  const cumMs = cumulativeMs(capturedAts, lapIdx, startedAt);
                  const delta = hasTargets
                    ? deltaMs(capturedAts, lapIdx, startedAt, targetMs)
                    : null;
                  const deltaColor =
                    delta === null
                      ? colors.neutral
                      : delta < 0
                      ? colors.success
                      : colors.danger;

                  return (
                    <TouchableOpacity
                      key={sp.id}
                      style={s.splitRow}
                      onPress={() =>
                        setEditing({ split: sp, value: formatMs(cumMs) })
                      }
                    >
                      <Text style={s.lapNum}>Lap {lapIdx + 1}</Text>
                      <Text style={s.lapMs}>{formatMs(lapMs)}</Text>
                      <Text style={s.cumMs}>{formatMs(cumMs)}</Text>
                      {delta !== null && (
                        <Text style={[s.delta, { color: deltaColor }]}>
                          {formatDeltaMs(delta)}
                        </Text>
                      )}
                      {sp.edited && <Text style={s.editedTag}>edited</Text>}
                    </TouchableOpacity>
                  );
                })}
            {row.splits.length === 0 && (
              <Text style={s.noSplits}>No splits recorded</Text>
            )}
          </View>
        );
      })}

      <TouchableOpacity style={s.discardBtn} onPress={onDiscard}>
        <Text style={s.discardText}>Discard Race</Text>
      </TouchableOpacity>

      <Modal visible={!!editing} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>Edit split (cumulative time)</Text>
            <TextInput
              style={s.dialogInput}
              value={editing?.value ?? ''}
              onChangeText={(v) =>
                setEditing((e) => (e ? { ...e, value: v } : null))
              }
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <Text style={s.dialogHint}>Format: M:SS.hh (e.g. 1:02.50)</Text>
            <View style={s.dialogActions}>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Text style={s.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onSaveEdit}>
                <Text style={s.save}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderLeftWidth: 4,
    marginBottom: 20,
    padding: 14,
  },
  cardName: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  lapNum: { color: colors.textSecondary, width: 50, fontSize: 13 },
  lapMs: {
    color: colors.textPrimary,
    fontSize: 16,
    fontFamily: 'monospace',
    width: 80,
  },
  cumMs: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: 'monospace',
    width: 80,
  },
  delta: { fontSize: 14, fontFamily: 'monospace', width: 60 },
  editedTag: { color: colors.warning, fontSize: 11, marginLeft: 4 },
  noSplits: { color: colors.textDisabled, fontSize: 14, fontStyle: 'italic' },
  discardBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  discardText: { color: colors.danger, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 32,
  },
  dialog: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 24,
  },
  dialogTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dialogInput: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    fontFamily: 'monospace',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialogHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancel: { color: colors.textSecondary, fontSize: 16, padding: 8 },
  save: { color: colors.accent, fontSize: 16, fontWeight: '700', padding: 8 },
  legDivider: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 4,
  },
  legDividerText: {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
