// app/(tabs)/athletes/index.tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { listAthletes, archiveAthlete } from '@/repos/athletes';
import type { Athlete } from '@/db/schema';
import { colors } from '@/theme/colors';

export default function AthletesScreen() {
  const [data, setData] = useState<Athlete[]>([]);
  const router = useRouter();

  const load = useCallback(() => {
    listAthletes().then(setData);
  }, []);

  useFocusEffect(load);

  const onArchive = (a: Athlete) => {
    Alert.alert(
      'Archive athlete?',
      `${a.name} will be hidden but their race history is preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => archiveAthlete(a.id).then(load),
        },
      ],
    );
  };

  return (
    <View style={s.container}>
      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => router.push(`/athletes/${item.id}`)}
          >
            <Text style={s.name}>{item.name}</Text>
            <TouchableOpacity onPress={() => onArchive(item)}>
              <Text style={s.archive}>Archive</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>No athletes yet. Tap + to add one.</Text>
        }
      />
      <TouchableOpacity style={s.fab} onPress={() => router.push('/athletes/new')}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 17, color: colors.textPrimary },
  archive: { fontSize: 14, color: colors.danger },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    color: colors.textSecondary,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
