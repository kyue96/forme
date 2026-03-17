import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';

interface CoachButtonProps {
  position: 'bottom-right' | 'bottom-left';
  onPress: () => void;
}

export function CoachButton({ position, onPress }: CoachButtonProps) {
  const { theme } = useSettings();

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        bottom: 100,
        ...(position === 'bottom-right' ? { right: 20 } : { left: 20 }),
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: theme.text,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <Ionicons name="sparkles" size={24} color={theme.background} />
    </Pressable>
  );
}
