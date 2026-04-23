// app/(tabs)/history/index.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

export default function HistoryScreen() {
  return (
    <View style={s.container}>
      <Text style={s.text}>Race history coming in Task 15</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  text: { color: colors.textSecondary },
});
