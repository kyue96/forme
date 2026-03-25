import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getExerciseImageUrls } from '@/lib/exercise-images';

interface ExerciseThumbnailProps {
  exerciseName: string;
  sets?: string;
  reps?: string;
  theme: any;
}

/**
 * Small play-circle icon next to exercise name that navigates to
 * the exercise demo screen (animated start/end images + coaching cues).
 * Only renders if the exercise has demo images available.
 */
export function ExerciseThumbnail({ exerciseName, sets, reps, theme }: ExerciseThumbnailProps) {
  const router = useRouter();
  const hasDemo = !!getExerciseImageUrls(exerciseName);

  if (!hasDemo) return null;

  return (
    <Pressable
      onPress={() => router.push({
        pathname: '/exercise-demo' as any,
        params: {
          exerciseName,
          ...(sets ? { sets } : {}),
          ...(reps ? { reps } : {}),
        },
      })}
      hitSlop={8}
      style={{ padding: 2, marginLeft: 6 }}
    >
      <Ionicons name="play-circle-outline" size={18} color="#F59E0B" />
    </Pressable>
  );
}

// Keep old alias
export const ExerciseInfoButton = ExerciseThumbnail;
