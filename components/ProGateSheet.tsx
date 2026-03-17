import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/lib/settings-context';
import { BottomSheet } from '@/components/BottomSheet';

const FEATURE_DESCRIPTIONS: Record<string, { title: string; description: string; icon: string }> = {
  workouts: {
    title: 'Workout Limit Reached',
    description: "Free accounts are limited to 4 workouts per week. Upgrade to Pro for unlimited workouts and more features!",
    icon: 'barbell-outline',
  },
  history: {
    title: 'Full History',
    description: 'Free accounts can view the last 3 months of workout history. Upgrade to Pro for complete history access!',
    icon: 'time-outline',
  },
  voice: {
    title: 'Voice Logging',
    description: 'Log your sets hands-free with voice commands. Upgrade to Pro to unlock voice logging!',
    icon: 'mic-outline',
  },
};

interface ProGateSheetProps {
  visible: boolean;
  onClose: () => void;
  feature: keyof typeof FEATURE_DESCRIPTIONS;
}

export function ProGateSheet({ visible, onClose, feature }: ProGateSheetProps) {
  const { theme } = useSettings();
  const info = FEATURE_DESCRIPTIONS[feature] ?? FEATURE_DESCRIPTIONS.workouts;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: '#EAB308' + '20',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Ionicons name={info.icon as any} size={28} color="#EAB308" />
        </View>

        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginBottom: 8, textAlign: 'center' }}>
          {info.title}
        </Text>
        <Text style={{ fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 16 }}>
          {info.description}
        </Text>

        <Pressable
          onPress={onClose}
          style={{
            backgroundColor: '#EAB308',
            paddingVertical: 16,
            paddingHorizontal: 48,
            borderRadius: 16,
            width: '100%',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>Go Pro</Text>
        </Pressable>

        <Pressable onPress={onClose} style={{ paddingVertical: 8 }}>
          <Text style={{ fontSize: 14, color: theme.textSecondary }}>Maybe later</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
