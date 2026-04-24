// app/(tabs)/index.tsx
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getRunningRace, getRecentRaces } from '@/repos/races';
import type { Race } from '@/db/schema';
import { lapCount } from '@/domain/distances';
import { colors } from '@/theme/colors';

function raceSummary(race: Race): string {
  const laps = lapCount(race.distanceM, race.lapDistanceM);
  return `${race.distanceM}m · ${laps} laps`;
}

export default function HomeScreen() {
  const [runningRace, setRunningRace] = useState<Race | null>(null);
  const [recent, setRecent]           = useState<Race[]>([]);
  const router = useRouter();

  const load = useCallback(() => {
    getRunningRace().then((r) => setRunningRace(r ?? null));
    getRecentRaces(10).then(setRecent);
  }, []);

  useFocusEffect(load);

  return (
    <View style={s.container}>
      {runningRace && (
        <TouchableOpacity
          style={s.resumeBanner}
          onPress={() => router.push(`/race/${runningRace.id}/live`)}
        >
          <Text style={s.resumeText}>⚡ Race in progress — tap to resume</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={recent}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <Text style={s.sectionHeader}>Recent Races</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.raceRow}
            onPress={() => router.push(`/race/${item.id}/review`)}
          >
            <Text style={s.raceDist}>{raceSummary(item)}</Text>
            <Text style={s.raceDate}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No races yet. Tap below to start one.</Text>
        }
      />
      <TouchableOpacity
        style={s.newRaceBtn}
        onPress={() => router.push('/race/setup')}
      >
        <Text style={s.newRaceBtnText}>+ New Race</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  resumeBanner: {
    backgroundColor: colors.warning,
    padding: 14,
    margin: 12,
    borderRadius: 10,
  },
  resumeText: { color: '#000', fontWeight: '700', textAlign: 'center' },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: 16,
    paddingBottom: 8,
  },
  raceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  raceDist: { color: colors.textPrimary, fontSize: 16 },
  raceDate: { color: colors.textSecondary, fontSize: 14 },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: colors.textSecondary,
    fontSize: 15,
  },
  newRaceBtn: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  newRaceBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
