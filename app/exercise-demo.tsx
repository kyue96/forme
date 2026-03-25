import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, Dimensions, Image,
  Animated, Easing, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useSettings } from '@/lib/settings-context';
import { getExerciseImageUrls } from '@/lib/exercise-images';
import { EXERCISE_INSTRUCTIONS } from '@/lib/exercise-data';
import { getExerciseCategory } from '@/lib/exercise-utils';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_W * 0.95;

export default function ExerciseDemoScreen() {
  const router = useRouter();
  const { theme } = useSettings();
  const params = useLocalSearchParams<{
    exerciseName: string;
    sets?: string;
    reps?: string;
  }>();

  const exerciseName = params.exerciseName ?? 'Exercise';
  const imageUrls = getExerciseImageUrls(exerciseName);
  const instructions = EXERCISE_INSTRUCTIONS[exerciseName.toLowerCase().trim()] ?? null;
  const muscleGroup = getExerciseCategory(exerciseName);
  const sets = params.sets ?? '';
  const reps = params.reps ?? '';

  // Parse coaching cues
  const cues = instructions
    ? instructions.split(/\.\s+/).filter(s => s.trim().length > 5).map(s => s.trim().replace(/\.$/, ''))
    : [];

  // Animated crossfade between start/end images
  const fadeAnim = useRef(new Animated.Value(0)).current; // 0 = start, 1 = end
  const [imagesLoaded, setImagesLoaded] = useState({ start: false, end: false });
  const [imageError, setImageError] = useState(false);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  // Derived animated values for phase pills (no state updates = no re-renders)
  const startPillOpacity = fadeAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [1, 0.4, 0.4, 0.4],
  });
  const endPillOpacity = fadeAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0.4, 0.4, 0.4, 1],
  });
  const startPillBg = fadeAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(245,158,11,1)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)'],
  });
  const endPillBg = fadeAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)', 'rgba(245,158,11,1)'],
  });

  // Animate loop: start -> end -> start -> ...
  const startAnimation = useCallback(() => {
    if (!imageUrls) return;

    const loop = Animated.loop(
      Animated.sequence([
        // Hold on start
        Animated.delay(1400),
        // Smooth ease to end
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // needed for color interpolation
        }),
        // Hold on end
        Animated.delay(1400),
        // Smooth ease to start
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    animRef.current = loop;
    loop.start();
  }, [imageUrls, fadeAnim]);

  // Start animation once both images load
  useEffect(() => {
    if (imagesLoaded.start && imagesLoaded.end) {
      startAnimation();
    }
    return () => {
      animRef.current?.stop();
    };
  }, [imagesLoaded.start, imagesLoaded.end, startAnimation]);

  const accentColor = '#F59E0B';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: theme.border,
        backgroundColor: theme.background,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: theme.text, textAlign: 'center', marginRight: 24 }}>
          Exercise Demo
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Viewport */}
        <View style={{
          height: IMAGE_HEIGHT,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          overflow: 'hidden',
        }}>
          {imageUrls ? (
            <View style={{ flex: 1 }}>
              {/* Start image (base layer) */}
              <Animated.View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
              }}>
                <Image
                  source={{ uri: imageUrls.start }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  onLoad={() => setImagesLoaded(prev => ({ ...prev, start: true }))}
                  onError={() => setImageError(true)}
                />
              </Animated.View>

              {/* End image (overlay) */}
              <Animated.View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                opacity: fadeAnim,
              }}>
                <Image
                  source={{ uri: imageUrls.end }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  onLoad={() => setImagesLoaded(prev => ({ ...prev, end: true }))}
                  onError={() => setImageError(true)}
                />
              </Animated.View>

              {/* Loading indicator */}
              {(!imagesLoaded.start || !imagesLoaded.end) && !imageError && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={accentColor} />
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>Loading demo...</Text>
                </View>
              )}

              {/* Phase indicator pills — fully animated, no state updates */}
              {imagesLoaded.start && imagesLoaded.end && (
                <View style={{
                  position: 'absolute', bottom: 12, alignSelf: 'center',
                  flexDirection: 'row', gap: 8,
                }}>
                  <Animated.View style={{
                    backgroundColor: startPillBg,
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                    opacity: startPillOpacity,
                  }}>
                    <Animated.Text style={{
                      fontSize: 10, fontWeight: '700', letterSpacing: 1,
                      color: fadeAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['#000', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.6)'],
                      }),
                    }}>
                      START
                    </Animated.Text>
                  </Animated.View>
                  <Animated.View style={{
                    backgroundColor: endPillBg,
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                    opacity: endPillOpacity,
                  }}>
                    <Animated.Text style={{
                      fontSize: 10, fontWeight: '700', letterSpacing: 1,
                      color: fadeAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0.6)', '#000'],
                      }),
                    }}>
                      END
                    </Animated.Text>
                  </Animated.View>
                </View>
              )}
            </View>
          ) : (
            /* No image fallback */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <Ionicons name="fitness-outline" size={48} color={theme.border} />
              <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 12, textAlign: 'center' }}>
                No demo available for this exercise yet
              </Text>
            </View>
          )}

          {/* Image load error */}
          {imageError && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cloud-offline-outline" size={36} color={theme.border} />
              <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>
                Could not load images
              </Text>
            </View>
          )}

          {/* Muscle group tag overlay */}
          {muscleGroup && (
            <View style={{
              position: 'absolute', top: 12, left: 12,
              backgroundColor: 'rgba(0,0,0,0.5)',
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
            }}>
              <Text style={{
                fontSize: 10, fontWeight: '700', color: '#FFFFFF',
                letterSpacing: 1.5, textTransform: 'uppercase',
              }}>
                {muscleGroup}
              </Text>
            </View>
          )}
        </View>

        {/* Exercise Info */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Exercise name */}
          <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text, marginBottom: 14 }}>
            {exerciseName}
          </Text>

          {/* Stats chips */}
          {(sets || reps) ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {sets ? (
                <View style={{
                  flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
                  borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{sets} sets</Text>
                </View>
              ) : null}
              {reps ? (
                <View style={{
                  flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
                  borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{reps} reps</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Coaching cues */}
          {cues.length > 0 && (
            <>
              <Text style={{
                fontSize: 10, fontWeight: '700', color: theme.textSecondary,
                letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
              }}>
                COACHING CUES
              </Text>
              {cues.map((cue, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: `${accentColor}20`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: accentColor }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 }}>
                    {cue}.
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* No instructions fallback */}
          {cues.length === 0 && (
            <View style={{
              backgroundColor: theme.surface, borderRadius: 12,
              borderWidth: 1, borderColor: theme.border, padding: 16,
            }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 18 }}>
                Coaching cues not yet available for this exercise. Focus on controlled movement, full range of motion, and proper breathing.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
