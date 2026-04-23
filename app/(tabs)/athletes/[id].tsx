// app/(tabs)/athletes/[id].tsx
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';

export default function AthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={s.container}>
      <Text style={s.text}>Athlete history coming in Phase 5 (id: {id})</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: colors.textSecondary },
});
