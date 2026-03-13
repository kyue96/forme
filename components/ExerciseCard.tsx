import { Pressable, Text, View } from 'react-native';
import { Exercise } from '@/lib/types';

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  isActive: boolean;
  onPress: () => void;
}

export function ExerciseCard({ exercise, index, isActive, onPress }: ExerciseCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 border-b border-zinc-100"
    >
      <View
        className={`
          w-8 h-8 rounded-full items-center justify-center mr-4 shrink-0
          ${isActive ? 'bg-zinc-900' : 'bg-zinc-100'}
        `}
      >
        <Text
          className={`text-xs font-bold ${isActive ? 'text-white' : 'text-zinc-400'}`}
        >
          {index + 1}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-semibold text-zinc-900">{exercise.name}</Text>
        <Text className="text-sm text-zinc-400 mt-0.5">
          {exercise.sets} sets · {exercise.reps} reps · {exercise.rest} rest
        </Text>
      </View>
    </Pressable>
  );
}
