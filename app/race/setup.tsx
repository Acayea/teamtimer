// app/race/setup.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { listAthletes } from '@/repos/athletes';
import { createRace } from '@/repos/races';
import { evenPaceTargets, negativeSplitTargets } from '@/domain/pacing';
import { STANDARD_DISTANCES, lapCount } from '@/domain/distances';
import { formatMs } from '@/domain/timing';
import type { Athlete } from '@/db/schema';
import { colors } from '@/theme/colors';
import { ChangeAthleteModal } from '@/components/ChangeAthleteModal';

type PacingStrategy = 'none' | 'even' | 'negative';
type RelayTeam = { name: string; legs: (string | null)[] };

export default function RaceSetupScreen() {
  const router = useRouter();
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [kind, setKind]           = useState<'individual' | 'relay'>('individual');
  const [distanceM, setDistanceM] = useState(1600);
  const [lapDistM]                = useState(400);
  const [athletes, setAthletes]   = useState<Athlete[]>([]);
  const [selected, setSelected]   = useState<(Athlete | null)[]>([null, null, null, null]);
  const [strategy, setStrategy]   = useState<PacingStrategy>('none');
  const [goalMs, setGoalMs]       = useState(240000);

  const [teams, setTeams] = useState<RelayTeam[]>([{ name: '', legs: [null, null, null, null] }]);
  const [expandedTeam, setExpandedTeam] = useState(0);
  const [pickingLeg, setPickingLeg] = useState<{ teamIdx: number; legIdx: number } | null>(null);

  const relayReady =
    kind === 'relay' &&
    teams.length > 0 &&
    teams.every((t) => t.name.trim() !== '' && t.legs.every((l) => l !== null));

  const relayOnStart = async () => {
    if (laps % 4 !== 0) return;
    const raceId = await createRace({
      kind: 'relay',
      distanceM,
      lapDistanceM: lapDistM,
      expectedLaps: laps,
      entries: teams.map((team, slotIndex) => ({
        slotIndex,
        teamName: team.name,
        legs: team.legs.map((athleteId, legIndex) => ({
          legIndex,
          athleteId: athleteId!,
        })),
      })),
    });
    router.replace(`/race/${raceId}/live`);
  };

  const load = useCallback(() => { listAthletes().then(setAthletes); }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (kind === 'relay' && lapCount(distanceM, lapDistM) % 4 !== 0) {
      setDistanceM(1600);
    }
  }, [kind, distanceM, lapDistM]);

  const laps = lapCount(distanceM, lapDistM);

  const toggleSlot = (slot: number, athlete: Athlete) => {
    setSelected((prev) => {
      const next = [...prev];
      next[slot] = next[slot]?.id === athlete.id ? null : athlete;
      return next;
    });
  };

  const assignToNextSlot = (athlete: Athlete) => {
    setSelected((prev) => {
      // If already assigned, remove
      if (prev.some((a) => a?.id === athlete.id)) {
        return prev.map((a) => (a?.id === athlete.id ? null : a));
      }
      // Assign to next empty slot
      const next = [...prev];
      const emptyIdx = next.findIndex((x) => x === null);
      if (emptyIdx !== -1) next[emptyIdx] = athlete;
      return next;
    });
  };

  const onStart = async () => {
    const activeSlots = selected
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a !== null);
    if (activeSlots.length === 0) return;

    let targetCumulativeMs: number[] | undefined;
    if (strategy === 'even') targetCumulativeMs = evenPaceTargets(laps, goalMs);
    if (strategy === 'negative') targetCumulativeMs = negativeSplitTargets(laps, goalMs, 0.02);

    const raceId = await createRace({
      kind,
      distanceM,
      lapDistanceM: lapDistM,
      expectedLaps: laps,
      entries: activeSlots.map(({ a, i }) => ({
        slotIndex: i,
        athleteId: a!.id,
        ...(targetCumulativeMs !== undefined ? { targetCumulativeMs } : {}),
      })),
    });

    router.replace(`/race/${raceId}/live`);
  };

  // Step 1: kind + distance
  if (step === 1) {
    const relayCompatibleDistances = kind === 'relay'
      ? STANDARD_DISTANCES.filter((d) => lapCount(d, lapDistM) % 4 === 0)
      : STANDARD_DISTANCES;

    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.heading}>Race Type</Text>
        <View style={s.row}>
          {(['individual', 'relay'] as const).map((k) => (
            <TouchableOpacity
              key={k}
              style={[s.chip, kind === k && s.chipActive]}
              onPress={() => setKind(k)}
            >
              <Text style={[s.chipText, kind === k && s.chipTextActive]}>
                {k === 'individual' ? 'Individual' : 'Relay'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.heading}>Distance</Text>
        <View style={s.row}>
          {relayCompatibleDistances.map((d) => (
            <TouchableOpacity
              key={d}
              style={[s.chip, distanceM === d && s.chipActive]}
              onPress={() => setDistanceM(d)}
            >
              <Text style={[s.chipText, distanceM === d && s.chipTextActive]}>{d}m</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.hint}>{laps} laps × {lapDistM}m</Text>

        <TouchableOpacity style={s.next} onPress={() => setStep(2)}>
          <Text style={s.nextText}>Next: Athletes →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Step 2 (relay): team builder
  if (step === 2 && kind === 'relay') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.heading}>Teams</Text>

        {teams.map((team, teamIdx) => {
          const isExpanded = expandedTeam === teamIdx;
          const teamColor = colors.slot[teamIdx as 0 | 1 | 2 | 3];
          return (
            <View key={teamIdx} style={[s.slotRow, { borderLeftColor: teamColor, flexDirection: 'column' }]}>
              <TouchableOpacity
                style={s.teamHeaderRow}
                onPress={() => setExpandedTeam(teamIdx)}
              >
                <Text style={[s.slotLabel, { color: teamColor }]}>#{teamIdx + 1}</Text>
                <Text style={s.slotAthlete}>{team.name || 'Team Name'}</Text>
              </TouchableOpacity>

              {isExpanded && (
                <View style={s.teamExpanded}>
                  <TextInput
                    style={s.teamNameInput}
                    value={team.name}
                    onChangeText={(text) =>
                      setTeams((prev) =>
                        prev.map((t, i) => (i === teamIdx ? { ...t, name: text } : t)),
                      )
                    }
                    placeholder="Team name"
                    placeholderTextColor={colors.textDisabled}
                  />
                  {[0, 1, 2, 3].map((legIdx) => {
                    const assignedId = team.legs[legIdx];
                    const assignedAthlete = assignedId
                      ? athletes.find((a) => a.id === assignedId)
                      : null;
                    return (
                      <TouchableOpacity
                        key={legIdx}
                        style={s.legRow}
                        onPress={() => setPickingLeg({ teamIdx, legIdx })}
                      >
                        <Text style={[s.legLabel, { color: teamColor }]}>
                          Leg {legIdx + 1}
                        </Text>
                        <Text style={s.legAthlete}>
                          {assignedAthlete?.name ?? 'Pick athlete…'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {teams.length < 4 && (
          <TouchableOpacity
            style={s.addTeamBtn}
            onPress={() => {
              const newIdx = teams.length;
              setTeams((prev) => [
                ...prev,
                { name: '', legs: [null, null, null, null] },
              ]);
              setExpandedTeam(newIdx);
            }}
          >
            <Text style={s.addTeamText}>+ Add Team</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.next, s.go, !relayReady && s.nextDisabled]}
          onPress={relayOnStart}
          disabled={!relayReady}
        >
          <Text style={s.nextText}>Start Race →</Text>
        </TouchableOpacity>

        <ChangeAthleteModal
          visible={pickingLeg !== null}
          athletes={athletes}
          onSelect={(athleteId) => {
            if (!pickingLeg) return;
            const { teamIdx, legIdx } = pickingLeg;
            setTeams((prev) =>
              prev.map((t, i) =>
                i === teamIdx
                  ? { ...t, legs: t.legs.map((l, j) => (j === legIdx ? athleteId : l)) }
                  : t,
              ),
            );
          }}
          onClose={() => setPickingLeg(null)}
        />
      </ScrollView>
    );
  }

  // Step 2: athlete assignment
  if (step === 2) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Text style={s.heading}>Athlete Slots</Text>
        {([0, 1, 2, 3] as const).map((slot) => (
          <View key={slot} style={[s.slotRow, { borderLeftColor: colors.slot[slot] }]}>
            <Text style={[s.slotLabel, { color: colors.slot[slot] }]}>#{slot + 1}</Text>
            <Text style={s.slotAthlete}>{selected[slot]?.name ?? '—'}</Text>
            {selected[slot] && (
              <TouchableOpacity onPress={() => toggleSlot(slot, selected[slot]!)}>
                <Text style={s.removeSlot}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={s.subheading}>Tap to assign athletes</Text>
        {athletes.map((a) => {
          const isAssigned = selected.some((x) => x?.id === a.id);
          return (
            <TouchableOpacity key={a.id} style={s.athleteRow} onPress={() => assignToNextSlot(a)}>
              <Text style={s.athleteName}>{a.name}</Text>
              {isAssigned && <Text style={s.check}>✓</Text>}
            </TouchableOpacity>
          );
        })}
        {athletes.length === 0 && (
          <Text style={s.hint}>No athletes yet — add them in the Athletes tab first.</Text>
        )}

        <TouchableOpacity
          style={[s.next, selected.every((x) => x === null) && s.nextDisabled]}
          onPress={() => setStep(3)}
          disabled={selected.every((x) => x === null)}
        >
          <Text style={s.nextText}>Next: Pacing →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Step 3: pacing strategy
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.heading}>Pacing Strategy (optional)</Text>
      {(['none', 'even', 'negative'] as PacingStrategy[]).map((strat) => (
        <TouchableOpacity
          key={strat}
          style={[s.chip, strategy === strat && s.chipActive]}
          onPress={() => setStrategy(strat)}
        >
          <Text style={[s.chipText, strategy === strat && s.chipTextActive]}>
            {strat === 'none'
              ? 'None (no targets)'
              : strat === 'even'
              ? 'Even pace'
              : 'Negative split (−2%)'}
          </Text>
        </TouchableOpacity>
      ))}

      {strategy !== 'none' && (
        <View>
          <Text style={s.subheading}>Goal time</Text>
          <View style={s.row}>
            {[180000, 210000, 240000, 270000, 300000].map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.chip, goalMs === t && s.chipActive]}
                onPress={() => setGoalMs(t)}
              >
                <Text style={[s.chipText, goalMs === t && s.chipTextActive]}>{formatMs(t)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity style={[s.next, s.go]} onPress={onStart}>
        <Text style={s.nextText}>Start Race →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  heading: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  subheading: { color: colors.textSecondary, fontSize: 13, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: 14, marginTop: 8 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderLeftWidth: 4,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 12,
  },
  slotLabel: { fontWeight: '700', width: 28, fontSize: 14 },
  slotAthlete: { color: colors.textPrimary, fontSize: 16, flex: 1 },
  removeSlot: { color: colors.danger, fontSize: 16, padding: 4 },
  athleteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  athleteName: { color: colors.textPrimary, fontSize: 16 },
  check: { color: colors.success, fontSize: 18 },
  next: {
    marginTop: 32,
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  nextDisabled: { opacity: 0.4 },
  go: { backgroundColor: colors.success },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  teamHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  teamExpanded: { marginTop: 8 },
  teamNameInput: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legLabel: { fontWeight: '700', fontSize: 13, width: 40 },
  legAthlete: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  addTeamBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  addTeamText: { color: colors.textSecondary, fontSize: 14 },
});
