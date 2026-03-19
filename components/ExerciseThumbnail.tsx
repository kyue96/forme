import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getExerciseImageUrls } from '@/lib/exercise-images';

interface ExerciseThumbnailProps {
  exerciseName: string;
  size?: number;
  theme: any;
}

/**
 * Tappable exercise thumbnail that shows the start position image.
 * Tapping opens a modal with side-by-side start → end position images.
 * Shows a barbell placeholder if no image is available.
 */
export function ExerciseThumbnail({ exerciseName, size = 40, theme }: ExerciseThumbnailProps) {
  const [showModal, setShowModal] = useState(false);
  const imgs = getExerciseImageUrls(exerciseName);

  return (
    <>
      <Pressable
        onPress={imgs ? () => setShowModal(true) : undefined}
        style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', marginRight: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}
      >
        {imgs ? (
          <ExpoImage source={{ uri: imgs.start }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="disk" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="barbell-outline" size={size * 0.45} color={theme.textSecondary} />
          </View>
        )}
      </Pressable>

      {imgs && (
        <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
          <Pressable
            onPress={() => setShowModal(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 }}>{exerciseName}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
                <ExpoImage source={{ uri: imgs.start }} style={{ width: '100%', aspectRatio: 0.85 }} contentFit="cover" cachePolicy="disk" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#999', textAlign: 'center', paddingVertical: 8 }}>START</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#999" />
              <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
                <ExpoImage source={{ uri: imgs.end }} style={{ width: '100%', aspectRatio: 0.85 }} contentFit="cover" cachePolicy="disk" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#999', textAlign: 'center', paddingVertical: 8 }}>END</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: '#666', marginTop: 16 }}>Tap anywhere to close</Text>
          </Pressable>
        </Modal>
      )}
    </>
  );
}
