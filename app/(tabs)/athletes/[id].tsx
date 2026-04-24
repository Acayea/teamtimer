// app/(tabs)/athletes/[id].tsx
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getAthlete, getAthleteRaces, type AthleteRaceResult } from '@/repos/athletes';
import type { Athlete } from '@/db/schema';
import { formatMs } from '@/domain/timing';
import { ImprovementChart } from '@/components/ImprovementChart';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const CHART_COLOR = '#3B82F6';

type DistanceGroup = {
  distanceM: number;
  races: AthleteRaceResult[]; // sorted by startedAt asc
  prMs: number;
  prRace: AthleteRaceResult;
};

function groupByDistance(raceResults: AthleteRaceResult[]): DistanceGroup[] {
  const map = new Map<number, AthleteRaceResult[]>();
  for (const r of raceResults) {
    if (!map.has(r.distanceM)) map.set(r.distanceM, []);
    map.get(r.distanceM)!.push(r);
  }
  return Array.from(map.entries())
    .map(([distanceM, distanceRaces]) => {
      const pr = Math.min(...distanceRaces.map(r => r.finalCumulativeMs));
      const prRace = distanceRaces.find(r => r.finalCumulativeMs === pr)!; // ties: first in startedAt-asc order
      return { distanceM, races: distanceRaces, prMs: pr, prRace };
    })
    .sort((a, b) => a.distanceM - b.distanceM);
}

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [groups, setGroups] = useState<DistanceGroup[]>([]);
  const [selectedDistanceM, setSelectedDistanceM] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    void (async () => {
      const [a, raceResults] = await Promise.all([getAthlete(id), getAthleteRaces(id)]);
      setAthlete(a ?? null);
      const g = groupByDistance(raceResults);
      setGroups(g);
      if (raceResults.length > 0) {
        // Default tab = distance of the most recently raced (last element, sorted by startedAt asc)
        setSelectedDistanceM(raceResults[raceResults.length - 1].distanceM);
      }
      setLoading(false);
    })();
  }, [id]);

  useFocusEffect(load);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!athlete) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>Athlete not found.</Text>
      </View>
    );
  }

  const totalRaces = groups.reduce((sum, g) => sum + g.races.length, 0);
  const selectedGroup = groups.find(g => g.distanceM === selectedDistanceM) ?? null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.name}>{athlete.name}</Text>
          <Text style={s.subtitle}>
            {totalRaces} race{totalRaces !== 1 ? 's' : ''} recorded
          </Text>
        </View>
        <TouchableOpacity
          style={s.editBtn}
          onPress={() => router.push(`/athletes/${id}/edit`)}
        >
          <Text style={s.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {groups.length === 0 ? (
        <Text style={s.empty}>No completed races yet.</Text>
      ) : (
        <>
          {/* Distance tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsScroll}
            contentContainerStyle={s.tabsContent}
          >
            {groups.map(g => (
              <TouchableOpacity
                key={g.distanceM}
                style={[s.tab, selectedDistanceM === g.distanceM && s.tabActive]}
                onPress={() => setSelectedDistanceM(g.distanceM)}
              >
                <Text
                  style={[
                    s.tabText,
                    selectedDistanceM === g.distanceM && s.tabTextActive,
                  ]}
                >
                  {g.distanceM}m
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedGroup && (
            <>
              {/* PR card */}
              <View style={s.prCard} testID="pr-card">
                <View>
                  <Text style={s.prLabel}>
                    {selectedGroup.distanceM}m Personal Record
                  </Text>
                  <Text style={s.prTime}>{formatMs(selectedGroup.prMs)}</Text>
                </View>
                <View style={s.prMeta}>
                  <Text style={s.prMetaText}>
                    {selectedGroup.prRace.meetName ?? 'Practice'}
                  </Text>
                  <Text style={s.prMetaText}>
                    {new Date(selectedGroup.prRace.startedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>

              {/* Chart */}
              <View style={s.chartCard}>
                <Text style={s.sectionLabel}>
                  Improvement · {selectedGroup.distanceM}m
                </Text>
                <ImprovementChart
                  data={selectedGroup.races.map(r => ({
                    raceId: r.raceId,
                    startedAt: r.startedAt,
                    cumulativeMs: r.finalCumulativeMs,
                  }))}
                  color={CHART_COLOR}
                  prMs={selectedGroup.prMs}
                  onDotPress={raceId => router.push(`/race/${raceId}/review`)}
                />
                {selectedGroup.races.length === 1 && (
                  <Text style={s.singleHint}>
                    Complete one more {selectedGroup.distanceM}m race to see your trend.
                  </Text>
                )}
              </View>

              {/* Race list */}
              <Text style={s.sectionLabel}>
                {selectedGroup.distanceM}m Races
              </Text>
              <View style={s.raceList}>
                {[...selectedGroup.races].reverse().map((r, i, arr) => {
                  const isPR = r.finalCumulativeMs === selectedGroup.prMs;
                  return (
                    <TouchableOpacity
                      key={r.raceId}
                      style={[s.raceRow, i < arr.length - 1 && s.raceRowBorder]}
                      onPress={() => router.push(`/race/${r.raceId}/review`)}
                    >
                      <View>
                        <Text style={s.raceName}>
                          {r.meetName ?? 'Practice'}
                        </Text>
                        <Text style={s.raceMeta}>
                          {new Date(r.startedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })} · {r.lapCount} lap{r.lapCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={[s.raceTime, isPR && s.raceTimePR]}>
                        {formatMs(r.finalCumulativeMs)}{isPR ? ' ★' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  editBtn: { backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  editBtnText: { fontSize: 13, color: colors.textSecondary },
  empty: { textAlign: 'center', marginTop: 48, color: colors.textSecondary, fontSize: 16 },
  tabsScroll: { marginBottom: 12 },
  tabsContent: { gap: 8 },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: CHART_COLOR },
  tabText: { fontSize: 13, color: colors.textDisabled },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  prCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  prLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  prTime: { ...typography.lapTime, color: colors.warning },
  prMeta: { alignItems: 'flex-end' },
  prMetaText: { fontSize: 12, color: colors.textSecondary },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  singleHint: { fontSize: 12, color: colors.textDisabled, textAlign: 'center', marginTop: 8 },
  raceList: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
  },
  raceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  raceRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  raceName: { fontSize: 14, color: colors.textPrimary },
  raceMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  raceTime: { ...typography.splitTime, color: colors.textPrimary },
  raceTimePR: { color: colors.warning },
});
