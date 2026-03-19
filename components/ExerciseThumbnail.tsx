import { useState } from 'react';
import { Image, Modal, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getExerciseImageUrls } from '@/lib/exercise-images';
import { PoseMannequin } from './PoseMannequin';
import { getExercisePoses } from '@/lib/exercise-poses';

interface ExerciseInfoButtonProps {
  exerciseName: string;
  theme: any;
}

/**
 * Filtered exercise image using pure RN style overlays.
 * Dark overlay + opacity creates a minimal bodysuit silhouette effect.
 * The white background of source images blends with the dark overlay.
 */
function FilteredExerciseImage({ uri, size }: { uri: string; size: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <View style={{ width: size, height: size, overflow: 'hidden', borderRadius: 12, backgroundColor: '#111' }}>
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 2 }}>
          <ActivityIndicator size="small" color="#555" />
        </View>
      )}
      {/* Base image with reduced opacity for muted look */}
      <Image
        source={{ uri }}
        style={{ width: size, height: size, opacity: 0.85 }}
        resizeMode="contain"
        onLoad={() => setLoading(false)}
        onError={() => { setError(true); setLoading(false); }}
      />
      {/* Dark tint overlay to mute colors and blend background */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(17, 17, 30, 0.55)',
          borderRadius: 12,
        }}
      />
    </View>
  );
}

/**
 * Info icon that opens a modal showing exercise form images.
 * Uses real exercise photos with dark overlay for a minimal bodysuit look.
 * Falls back to SVG mannequin if no images available.
 * Long press navigates to exercise detail page.
 */
export function ExerciseInfoButton({ exerciseName, theme }: ExerciseInfoButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const images = getExerciseImageUrls(exerciseName);

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
          style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 24 }}>{exerciseName}</Text>

          {images ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <FilteredExerciseImage uri={images.start} size={150} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#555', marginTop: 8 }}>START</Text>
              </View>

              <Ionicons name="arrow-forward" size={20} color="#444" />

              <View style={{ alignItems: 'center' }}>
                <FilteredExerciseImage uri={images.end} size={150} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#555', marginTop: 8 }}>END</Text>
              </View>
            </View>
          ) : (
            // Fallback to SVG mannequin
            (() => {
              const [startPose, endPose] = getExercisePoses(exerciseName);
              const isStatic = JSON.stringify(startPose) === JSON.stringify(endPose);

              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#222' }}>
                      <PoseMannequin pose={startPose} size={140} variant="dark" />
                    </View>
                    {!isStatic && <Text style={{ fontSize: 11, fontWeight: '600', color: '#555', marginTop: 8 }}>START</Text>}
                  </View>

                  {!isStatic && (
                    <>
                      <Ionicons name="arrow-forward" size={20} color="#444" />
                      <View style={{ alignItems: 'center' }}>
                        <View style={{ backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#222' }}>
                          <PoseMannequin pose={endPose} size={140} variant="dark" />
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#555', marginTop: 8 }}>END</Text>
                      </View>
                    </>
                  )}
                </View>
              );
            })()
          )}

          <Text style={{ fontSize: 12, color: '#444', marginTop: 20 }}>Tap to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

// Keep old name as alias for backward compat
export const ExerciseThumbnail = ExerciseInfoButton;
