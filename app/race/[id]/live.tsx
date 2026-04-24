// app/race/[id]/live.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getRace,
  getRaceEntries,
  startRace,
  endRace,
  getRelayLegsForEntry,
  updateRelayLegAthlete,
} from '@/repos/races';
import {
  appendSplit,
  undoLastSplit,
  getSplitsForEntry,
  getTargetsForEntry,
} from '@/repos/splits';
import { getAthlete, listAthletes } from '@/repos/athletes';
import type { Race, RaceEntry, Split, TargetSplit, RelayLeg, Athlete } from '@/db/schema';
import { useRaceClock } from '@/hooks/useRaceClock';
import { useKeepAwake } from '@/hooks/useKeepAwake';
import { AthleteCell } from '@/components/AthleteCell';
import { RaceClock } from '@/components/RaceClock';
import { RelayCell } from '@/components/RelayCell';
import { ChangeAthleteModal } from '@/components/ChangeAthleteModal';
import { colors } from '@/theme/colors';

type EntryState = {
  entry: RaceEntry;
  splits: Split[];
  targets: TargetSplit[];
  athleteName: string;
};

type Phase = 'pre' | 'running' | 'done';

export default function LiveRaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [race, setRace]             = useState<Race | null>(null);
  const [entries, setEntries]       = useState<EntryState[]>([]);
  const [startedAt, setStartedAt]   = useState<number | null>(null);
  const [phase, setPhase]           = useState<Phase>('pre');
  const [lastTapEntry, setLastTapEntry] = useState<string | null>(null);

  const [relayLegsMap, setRelayLegsMap]       = useState<Record<string, RelayLeg[]>>({});
  const [athleteNamesMap, setAthleteNamesMap] = useState<Record<string, string>>({});
  const [changingEntryId, setChangingEntryId] = useState<string | null>(null);
  const [allAthletes, setAllAthletes]         = useState<Athlete[]>([]);

  const elapsed = useRaceClock(phase === 'running' ? startedAt : null);
  useKeepAwake(phase === 'running');

  const loadData = useCallback(async () => {
    const r = await getRace(id);
    if (!r) return;
    setRace(r);

    if (r.status === 'running' && r.startedAt) {
      setStartedAt(r.startedAt);
      setPhase('running');
    } else if (r.status === 'completed') {
      setPhase('done');
    }

    const rawEntries = await getRaceEntries(id);
    const states = await Promise.all(
      rawEntries.map(async (entry) => {
        const [splitsData, targets] = await Promise.all([
          getSplitsForEntry(entry.id),
          getTargetsForEntry(entry.id),
        ]);
        let athleteName = entry.teamName ?? entry.athleteId ?? '?';
        if (entry.athleteId) {
          const a = await getAthlete(entry.athleteId);
          if (a) athleteName = a.name;
        }
        return {
          entry,
          splits: splitsData,
          targets,
          athleteName,
        } satisfies EntryState;
      }),
    );
    setEntries(states.sort((a, b) => a.entry.slotIndex - b.entry.slotIndex));

    if (r.kind === 'relay') {
      const allA = await listAthletes();
      setAllAthletes(allA);
      setAthleteNamesMap(Object.fromEntries(allA.map((a) => [a.id, a.name])));

      const legsMap: Record<string, RelayLeg[]> = Object.fromEntries(
        await Promise.all(
          rawEntries.map(async (entry) => [entry.id, await getRelayLegsForEntry(entry.id)]),
        ),
      );
      setRelayLegsMap(legsMap);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onGo = async () => {
    const ts = await startRace(id);
    setStartedAt(ts);
    setPhase('running');
  };

  const onTap = async (entryIndex: number) => {
    if (!race || !startedAt) return;
    const es = entries[entryIndex];
    const lapIndex = es.splits.length;
    if (lapIndex >= race.expectedLaps) return;

    const capturedAt = await appendSplit(es.entry.id, lapIndex);
    setLastTapEntry(es.entry.id);

    const newSplit: Split = {
      id: '',
      raceEntryId: es.entry.id,
      lapIndex,
      capturedAt,
      edited: false,
    };

    const updatedEntries = entries.map((e, i) =>
      i === entryIndex ? { ...e, splits: [...e.splits, newSplit] } : e,
    );
    setEntries(updatedEntries);

    const allDone = updatedEntries.every((e) => e.splits.length >= race.expectedLaps);
    if (allDone) {
      await endRace(id);
      setPhase('done');
    }
  };

  const onUndo = async () => {
    if (!lastTapEntry) return;
    await undoLastSplit(lastTapEntry);
    setLastTapEntry(null);
    await loadData();
  };

  const onEndRace = () => {
    Alert.alert('End race?', 'This will stop the clock for all athletes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Race',
        style: 'destructive',
        onPress: async () => {
          await endRace(id);
          setPhase('done');
        },
      },
    ]);
  };

  const onChangeLeg = async (entryId: string, newAthleteId: string) => {
    if (!race) return;
    const legs = relayLegsMap[entryId] ?? [];
    const es = entries.find((e) => e.entry.id === entryId);
    const lapsPerLeg = race.expectedLaps / 4;
    const currentLegIndex = Math.min(3, Math.floor((es?.splits.length ?? 0) / lapsPerLeg));
    const leg = legs[currentLegIndex];
    if (!leg) return;
    try {
      await updateRelayLegAthlete(leg.id, newAthleteId);
      const updatedLegs = await getRelayLegsForEntry(entryId);
      setRelayLegsMap((prev) => ({ ...prev, [entryId]: updatedLegs }));
      if (!athleteNamesMap[newAthleteId]) {
        const athlete = await getAthlete(newAthleteId);
        if (athlete) setAthleteNamesMap((prev) => ({ ...prev, [athlete.id]: athlete.name }));
      }
    } catch {
      Alert.alert('Error', 'Could not update athlete. Please try again.');
    }
    setChangingEntryId(null);
  };

  if (!race) return null;

  // PRE-RACE OVERLAY
  if (phase === 'pre') {
    return (
      <View style={s.fullscreen}>
        <StatusBar barStyle="light-content" />
        <Text style={s.raceTitle}>{race.distanceM}m — {race.expectedLaps} Laps</Text>
        <Text style={s.goHint}>Tap GO when the gun fires.</Text>
        <Text style={s.goWarning}>Keep the app open — screen will stay on.</Text>
        <TouchableOpacity
          style={s.goBtn}
          onPress={onGo}
          accessibilityLabel="Start race"
        >
          <Text style={s.goBtnText}>GO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // DONE OVERLAY
  if (phase === 'done') {
    return (
      <View style={s.fullscreen}>
        <Text style={s.raceTitle}>Race Complete</Text>
        <TouchableOpacity
          style={[s.goBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.replace(`/race/${id}/review`)}
        >
          <Text style={s.goBtnText}>Review →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // RUNNING
  const gridStyle = entries.length <= 2 ? s.grid1col : s.grid2col;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <RaceClock elapsedMs={elapsed} />
      <View style={gridStyle}>
        {entries.map((es, i) => {
          if (race.kind === 'relay') {
            const lapsPerLeg = race.expectedLaps / 4;
            const currentLegIndex = Math.min(3, Math.floor(es.splits.length / lapsPerLeg));
            const legs = relayLegsMap[es.entry.id] ?? [];
            const legRunnerNames = [0, 1, 2, 3].map(
              (legIdx) => athleteNamesMap[legs[legIdx]?.athleteId ?? ''] ?? '?',
            );
            return (
              <RelayCell
                key={es.entry.id}
                teamName={es.entry.teamName ?? '?'}
                slotIndex={es.entry.slotIndex as 0 | 1 | 2 | 3}
                currentLegIndex={currentLegIndex}
                legRunnerNames={legRunnerNames}
                capturedAts={es.splits.map((sp) => sp.capturedAt)}
                startedAt={startedAt!}
                elapsedMs={elapsed}
                expectedLaps={race.expectedLaps}
                onTap={() => onTap(i)}
                onChangeLeg={() => setChangingEntryId(es.entry.id)}
                finished={es.splits.length >= race.expectedLaps}
              />
            );
          }
          return (
            <AthleteCell
              key={es.entry.id}
              name={es.athleteName}
              slotIndex={es.entry.slotIndex as 0 | 1 | 2 | 3}
              lapIndex={es.splits.length}
              expectedLaps={race.expectedLaps}
              capturedAts={es.splits.map((sp) => sp.capturedAt)}
              startedAt={startedAt!}
              {...(es.targets.length > 0
                ? { targetCumulativeMs: es.targets.map((t) => t.targetMs) }
                : {})}
              onTap={() => onTap(i)}
              finished={es.splits.length >= race.expectedLaps}
            />
          );
        })}
      </View>
      {race.kind === 'relay' && (
        <ChangeAthleteModal
          visible={changingEntryId !== null}
          athletes={allAthletes}
          onSelect={(athleteId) => {
            if (changingEntryId) {
              void onChangeLeg(changingEntryId, athleteId);
            }
          }}
          onClose={() => setChangingEntryId(null)}
        />
      )}
      <View style={s.controls}>
        <TouchableOpacity
          style={s.undoBtn}
          onPress={onUndo}
          disabled={!lastTapEntry}
        >
          <Text style={[s.undoBtnText, !lastTapEntry && s.disabled]}>↩ Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.endBtn} onLongPress={onEndRace} delayLongPress={2000}>
          <Text style={s.endBtnText}>End Race (hold)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 48,
    paddingHorizontal: 8,
  },
  raceTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  goHint: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  goWarning: {
    color: colors.warning,
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 32,
  },
  goBtn: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnText: { color: '#fff', fontSize: 52, fontWeight: '900' },
  grid1col: { flex: 1, flexDirection: 'column', padding: 4 },
  grid2col: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 4 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 24,
    paddingTop: 8,
  },
  undoBtn: { padding: 12 },
  undoBtnText: { color: colors.textSecondary, fontSize: 15 },
  endBtn: { padding: 12 },
  endBtnText: { color: colors.danger, fontSize: 15 },
  disabled: { opacity: 0.3 },
});
