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

export function SetRow({
  setNumber,
  data,
  onChange,
  onComplete,
  isBodyweight,
  weightLabel = 'Weight',
}: SetRowProps) {
  const { theme } = useSettings();

  const handleToggle = () => {
    if (data.completed) {
      onChange({ ...data, completed: false });
    } else {
      onComplete();
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: data.completed ? theme.surface : theme.background,
        borderWidth: 1,
        borderColor: data.completed ? theme.chrome : theme.border,
      }}
    >
      <Text style={{ width: 28, fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
        {setNumber}
      </Text>

      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {!isBodyweight && (
          <>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {weightLabel}
              </Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: '600', color: theme.text, padding: 0 }}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={theme.textSecondary}
                underlineColorAndroid="transparent"
                value={data.weight != null ? String(data.weight) : ''}
                onChangeText={(v) => onChange({ ...data, weight: v === '' ? null : parseFloat(v) })}
                editable={!data.completed}
              />
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: theme.border }} />
          </>
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Reps
          </Text>
          <TextInput
            style={{ fontSize: 16, fontWeight: '600', color: theme.text, padding: 0 }}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={theme.textSecondary}
            underlineColorAndroid="transparent"
            value={data.reps > 0 ? String(data.reps) : ''}
            onChangeText={(v) => onChange({ ...data, reps: parseInt(v) || 0 })}
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
          backgroundColor: data.completed ? theme.text : 'transparent',
          borderWidth: data.completed ? 0 : 2,
          borderColor: theme.border,
        }}
      >
        {data.completed && (
          <Text style={{ color: theme.background, fontSize: 14, fontWeight: '700' }}>✓</Text>
        )}
      </Pressable>
    </View>
  );
}
