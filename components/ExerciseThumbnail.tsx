import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PoseMannequin, STANDING } from './PoseMannequin';
import { getExercisePoses } from '@/lib/exercise-poses';

interface ExerciseInfoButtonProps {
  exerciseName: string;
  theme: any;
}

/**
 * Info icon that opens a modal showing the exercise pose (start/end)
 * using the SVG mannequin. Long press navigates to exercise detail page.
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
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 24 }}>{exerciseName}</Text>

          {(() => {
            const [startPose, endPose] = getExercisePoses(exerciseName);
            const isStatic = JSON.stringify(startPose) === JSON.stringify(endPose);

            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#333' }}>
                    <PoseMannequin pose={startPose} size={140} color="#999" strokeWidth={2.5} />
                  </View>
                  {!isStatic && <Text style={{ fontSize: 11, fontWeight: '600', color: '#666', marginTop: 8 }}>START</Text>}
                </View>

                {!isStatic && (
                  <>
                    <Ionicons name="arrow-forward" size={20} color="#666" />
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#333' }}>
                        <PoseMannequin pose={endPose} size={140} color="#999" strokeWidth={2.5} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#666', marginTop: 8 }}>END</Text>
                    </View>
                  </>
                )}
              </View>
            );
          })()}

          <Text style={{ fontSize: 12, color: '#555', marginTop: 20 }}>Tap to close · Hold icon for history</Text>
        </Pressable>
      </Modal>
    </>
  );
}

// Keep old name as alias for backward compat
export const ExerciseThumbnail = ExerciseInfoButton;
