import { useState, useEffect } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { useSettings } from '@/lib/settings-context';
import { EXERCISE_CATEGORIES, EQUIPMENT_TYPES } from '@/lib/exercise-data';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, muscleGroup: string, equipment: string) => void;
  /** If provided, pre-populates fields for editing */
  initialValues?: { name: string; muscleGroup: string; equipment: string | null };
  /** Button label — defaults to "Create" */
  saveLabel?: string;
}

export function CustomExerciseSheet({ visible, onClose, onSave, initialValues, saveLabel }: Props) {
  const { theme } = useSettings();
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('Chest');
  const [equipment, setEquipment] = useState('Barbell');

  // Reset / populate fields when modal opens
  useEffect(() => {
    if (visible) {
      if (initialValues) {
        setName(initialValues.name);
        setMuscleGroup(initialValues.muscleGroup || 'Chest');
        setEquipment(initialValues.equipment || 'Barbell');
      } else {
        setName('');
        setMuscleGroup('Chest');
        setEquipment('Barbell');
      }
    }
  }, [visible]);

  const handleClose = () => {
    setName('');
    setEquipment('Barbell');
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), muscleGroup, equipment);
    setName('');
    setEquipment('Barbell');
  };

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 }}>
        {initialValues ? 'Edit Exercise' : 'Custom Exercise'}
      </Text>
      <TextInput
        style={{
          fontSize: 16, color: theme.text, backgroundColor: theme.background,
          borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
          borderWidth: 1, borderColor: theme.border, marginBottom: 12,
        }}
        placeholder="Exercise name"
        placeholderTextColor={theme.textSecondary}
        value={name}
        onChangeText={setName}
        autoFocus
      />
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Muscle Group</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {EXERCISE_CATEGORIES.filter((cat) => cat !== 'Cardio').map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setMuscleGroup(cat)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: muscleGroup === cat ? theme.text : theme.background,
                borderWidth: 1, borderColor: muscleGroup === cat ? theme.text : theme.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: muscleGroup === cat ? theme.background : theme.text }}>{cat}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Equipment</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {EQUIPMENT_TYPES.map((eq) => (
            <Pressable
              key={eq}
              onPress={() => setEquipment(eq)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: equipment === eq ? theme.text : theme.background,
                borderWidth: 1, borderColor: equipment === eq ? theme.text : theme.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: equipment === eq ? theme.background : theme.text }}>{eq}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          onPress={handleClose}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.text }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.background }}>{saveLabel ?? (initialValues ? 'Save' : 'Create')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
