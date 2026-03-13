import { Pressable, Text, TextInput, View } from 'react-native';
import { LoggedSet } from '@/lib/types';

interface SetRowProps {
  setNumber: number;
  data: LoggedSet;
  onChange: (data: LoggedSet) => void;
  onComplete: () => void;
}

export function SetRow({ setNumber, data, onChange, onComplete }: SetRowProps) {
  return (
    <View
      className={`
        flex-row items-center mb-2 p-3 rounded-xl
        ${data.completed ? 'bg-zinc-100' : 'bg-white border border-zinc-200'}
      `}
    >
      <Text className="w-8 text-sm font-semibold text-zinc-400">{setNumber}</Text>

      <View className="flex-1 flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-xs text-zinc-400 mb-0.5">Weight (kg)</Text>
          <TextInput
            className="text-base font-semibold text-zinc-900"
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor="#A1A1AA"
            value={data.weight != null ? String(data.weight) : ''}
            onChangeText={(v) =>
              onChange({ ...data, weight: v === '' ? null : parseFloat(v) })
            }
            editable={!data.completed}
          />
        </View>

        <View className="w-px h-8 bg-zinc-200" />

        <View className="flex-1">
          <Text className="text-xs text-zinc-400 mb-0.5">Reps</Text>
          <TextInput
            className="text-base font-semibold text-zinc-900"
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor="#A1A1AA"
            value={data.reps > 0 ? String(data.reps) : ''}
            onChangeText={(v) =>
              onChange({ ...data, reps: parseInt(v) || 0 })
            }
            editable={!data.completed}
          />
        </View>
      </View>

      <Pressable
        onPress={onComplete}
        disabled={data.completed}
        className={`
          ml-3 w-9 h-9 rounded-full items-center justify-center
          ${data.completed ? 'bg-zinc-900' : 'border-2 border-zinc-300'}
        `}
      >
        {data.completed ? (
          <Text className="text-white text-sm">✓</Text>
        ) : null}
      </Pressable>
    </View>
  );
}
