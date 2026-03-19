import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Exercise } from '@/lib/types';
import { getExerciseStartImage } from '@/lib/exercise-images';

interface ExerciseCardProps {
  exercise: Exercise;
  index: number;
  isActive: boolean;
  onPress: () => void;
}

export function ExerciseCard({ exercise, index, isActive, onPress }: ExerciseCardProps) {
  const imageUrl = getExerciseStartImage(exercise.name);

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

      {/* Exercise thumbnail */}
      <View style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', marginRight: 12, backgroundColor: '#f4f4f5' }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 44, height: 44 }}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="barbell-outline" size={20} color="#a1a1aa" />
          </View>
        )}
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
