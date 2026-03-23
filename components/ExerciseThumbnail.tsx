import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ExerciseInfoButtonProps {
  exerciseName: string;
  theme: any;
}

/**
 * Info icon that opens a modal with a "coming soon" placeholder for exercise illustrations.
 * Long press navigates to exercise detail page (history/charts).
 */
export function ExerciseInfoButton({ exerciseName, theme }: ExerciseInfoButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        onLongPress={() => router.push({ pathname: '/exercise-detail', params: { exerciseName } })}
        hitSlop={8}
        style={{ padding: 4, marginLeft: 6 }}
      >
        <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable
          onPress={() => setShowModal(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        >
          {/* Card */}
          <View style={{
            backgroundColor: '#1A1A1A',
            borderRadius: 20,
            padding: 32,
            alignItems: 'center',
            width: '100%',
            maxWidth: 320,
            borderWidth: 1,
            borderColor: '#2A2A2A',
          }}>
            {/* Icon */}
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#2A2A2A',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="image-outline" size={28} color="#555" />
            </View>

            {/* Exercise name */}
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 }}>
              {exerciseName}
            </Text>

            {/* Coming soon message */}
            <Text style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 }}>
              Exercise illustrations coming soon
            </Text>

            {/* Dismiss hint */}
            <Text style={{ fontSize: 12, color: '#444', marginTop: 24 }}>Tap to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// Keep old name as alias for backward compat
export const ExerciseThumbnail = ExerciseInfoButton;
