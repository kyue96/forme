import { Pressable, Text, TextInput, View } from 'react-native';
import { useSettings } from '@/lib/settings-context';
import { LoggedSet } from '@/lib/types';

interface SetRowProps {
  setNumber: number;
  data: LoggedSet;
  onChange: (data: LoggedSet) => void;
  onComplete: () => void;
  isBodyweight?: boolean;
  weightLabel?: string;
}

export function SetRow({ setNumber, data, onChange, onComplete, isBodyweight, weightLabel = 'Weight' }: SetRowProps) {
  const { theme } = useSettings();

  const handleToggle = () => {
    if (data.completed) {
      onChange({ ...data, completed: false });
    } else {
      onComplete();
    }
  };

  const handleWeightChange = (v: string) => {
    const weight = v === '' ? null : parseFloat(v);
    onChange({ ...data, weight });
    if (weight != null && weight > 0 && data.reps > 0 && !data.completed) {
      setTimeout(() => onComplete(), 50);
    }
  };

  const handleRepsChange = (v: string) => {
    const reps = parseInt(v) || 0;
    onChange({ ...data, reps });
    if (reps > 0 && data.weight != null && data.weight > 0 && !data.completed) {
      setTimeout(() => onComplete(), 50);
    }
  };

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: data.completed ? theme.surface : theme.background,
      borderWidth: 1,
      borderColor: data.completed ? '#22C55E' : theme.border,
    }}>
      {/* Bullet indicator */}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: data.completed ? '#22C55E' : '#EAB308', marginRight: 10 }} />

      <Text style={{ width: 24, fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>{setNumber}</Text>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {!isBodyweight && (
          <>
            <View style={{ flex: 1 }}>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: theme.text, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
                keyboardType="decimal-pad"
                placeholder="Weight"
                placeholderTextColor={theme.textSecondary}
                underlineColorAndroid="transparent"
                value={data.weight != null ? String(data.weight) : ''}
                onChangeText={handleWeightChange}
                editable={!data.completed}
              />
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: theme.border }} />
          </>
        )}

        <View style={{ flex: 1 }}>
          <TextInput
            style={{ fontSize: 16, fontWeight: '600', color: theme.text, backgroundColor: theme.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
            keyboardType="number-pad"
            placeholder="Reps"
            placeholderTextColor={theme.textSecondary}
            underlineColorAndroid="transparent"
            value={data.reps > 0 ? String(data.reps) : ''}
            onChangeText={handleRepsChange}
            editable={!data.completed}
          />
        </View>
      </View>

      <Pressable
        onPress={handleToggle}
        style={{
          marginLeft: 12,
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: data.completed ? '#22C55E' : 'transparent',
          borderWidth: data.completed ? 0 : 2,
          borderColor: '#EAB308',
        }}
      >
        {data.completed && <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>✓</Text>}
      </Pressable>
    </View>
  );
}
