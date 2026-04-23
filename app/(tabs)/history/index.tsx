// app/(tabs)/history/index.tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getRecentRaces } from '@/repos/races';
import { lapCount } from '@/domain/distances';
import type { Race } from '@/db/schema';
import { colors } from '@/theme/colors';

export default function HistoryScreen() {
  const [races, setRaces] = useState<Race[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      getRecentRaces(100).then(setRaces);
    }, []),
  );

  return (
    <View style={s.container}>
      <FlatList
        data={races}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push(`/race/${item.id}/review`)}
          >
            <View>
              <Text style={s.dist}>
                {item.distanceM}m · {lapCount(item.distanceM, item.lapDistanceM)} laps
              </Text>
              <Text style={s.kind}>{item.kind}</Text>
            </View>
            <Text style={s.date}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No completed races yet.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dist: { color: colors.textPrimary, fontSize: 16 },
  kind: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  date: { color: colors.textSecondary, fontSize: 14 },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: colors.textSecondary,
    fontSize: 15,
  },
});
