// src/components/ChangeAthleteModal.tsx
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import type { Athlete } from '@/db/schema';
import { colors } from '@/theme/colors';

type Props = {
  visible: boolean;
  athletes: Athlete[];
  onSelect: (athleteId: string) => void;
  onClose: () => void;
};

export function ChangeAthleteModal({ visible, athletes, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.sheet}>
          <Text style={s.title}>Select Athlete</Text>
          <FlatList
            data={athletes}
            keyExtractor={(a) => a.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.row}
                onPress={() => { onSelect(item.id); onClose(); }}
              >
                <Text style={s.name}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    padding: 16,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { color: colors.textPrimary, fontSize: 16 },
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
