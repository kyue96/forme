import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ExerciseInfoButtonProps {
  exerciseName: string;
  theme: any;
}

/**
 * Info icon button that navigates to the exercise detail page.
 * Place to the right of the exercise name.
 */
export function ExerciseInfoButton({ exerciseName, theme }: ExerciseInfoButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/exercise-detail', params: { exerciseName } })}
      hitSlop={8}
      style={{ padding: 4, marginLeft: 6 }}
    >
      <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

// Keep old name as alias for backward compat
export const ExerciseThumbnail = ExerciseInfoButton;
