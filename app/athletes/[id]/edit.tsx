// app/athletes/[id]/edit.tsx
import { useEffect, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAthlete, updateAthlete } from '@/repos/athletes';
import { colors } from '@/theme/colors';

export default function EditAthleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const router = useRouter();

  useEffect(() => {
    getAthlete(id).then((a) => {
      if (a) {
        setName(a.name);
        setNotes(a.notes ?? '');
      }
    });
  }, [id]);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateAthlete(id, { name: trimmed, notes: notes.trim() || null });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={s.label}>Name *</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholderTextColor={colors.textDisabled}
      />
      <Text style={s.label}>Notes</Text>
      <TextInput
        style={[s.input, s.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholderTextColor={colors.textDisabled}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity
        style={[s.btn, !name.trim() && s.btnDisabled]}
        onPress={onSave}
        disabled={!name.trim()}
      >
        <Text style={s.btnText}>Save Changes</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  label: {
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 4,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  btn: {
    marginTop: 32,
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
