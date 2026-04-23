// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { runMigrations } from '@/db/migrate';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    runMigrations().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.textPrimary }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="race/setup" options={{ title: 'New Race', presentation: 'modal' }} />
      <Stack.Screen name="race/[id]/live" options={{ headerShown: false }} />
      <Stack.Screen name="race/[id]/review" options={{ title: 'Race Review' }} />
      <Stack.Screen name="athletes/new" options={{ title: 'Add Athlete', presentation: 'modal' }} />
      <Stack.Screen name="athletes/[id]/edit" options={{ title: 'Edit Athlete' }} />
    </Stack>
  );
}
