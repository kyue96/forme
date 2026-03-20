import { useState, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { LoggedExercise } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';
import { isBodyweightExercise } from '@/lib/exercise-data';
import { formatTime, animateLayout, formatNumber } from '@/lib/utils';
import { getExerciseImageUrls } from '@/lib/exercise-images';
import { Image as ExpoImage } from 'expo-image';
import { ExerciseThumbnail } from '@/components/ExerciseThumbnail';
import { isBarbell } from '@/lib/plate-calculator';
import { PlateCalculatorSheet } from '@/components/PlateCalculatorSheet';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';

export default function SessionViewScreen() {
  const router = useRouter();
  const { weightUnit, theme } = useSettings();
  const params = useLocalSearchParams<{
    exercises: string;
    dayName: string;
    focus: string;
    durationMinutes: string;
    completedAt: string;
    logId: string;
  }>();

  const avatarColor = useUserStore((s) => s.avatarColor);
  const sessionCardRef = useRef<View>(null);

  const exercises: LoggedExercise[] = params.exercises ? JSON.parse(params.exercises) : [];
  const durationMinutes = parseInt(params.durationMinutes ?? '0', 10);
  const durationSeconds = durationMinutes * 60;
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const sessionTotalSets = exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).length, 0);
  const sessionVolumeRaw = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed && s.weight != null).reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0), 0
  );
  const sessionVolume = Math.round(sessionVolumeRaw);
  const sessionTotalReps = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed).reduce((r, set) => r + set.reps, 0), 0
  );

  const handleShareSession = useCallback(async () => {
    if (!sessionCardRef.current) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to share.');
        return;
      }
      const uri = await captureRef(sessionCardRef.current, { format: 'png', quality: 1 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      await Share.share({
        url: asset.uri,
        message: `Just finished ${params.dayName ?? 'my workout'}: ${exercises.length} exercises, ${sessionTotalSets} sets in ${durationMinutes} min`,
      });
    } catch {}
  }, [params.dayName, exercises.length, sessionTotalSets, durationMinutes]);

  const completedDate = params.completedAt
    ? new Date(params.completedAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const [activeExercise, setActiveExercise] = useState<number | 'all' | null>(null);

  // Editable exercises (Step 13)
  const [editableExercises, setEditableExercises] = useState<LoggedExercise[]>(exercises);
  const [editingExIdx, setEditingExIdx] = useState<number | null>(null);

  // Editable workout name (Step 14)
  const [workoutName, setWorkoutName] = useState(params.focus ?? params.dayName ?? 'Workout');
  const [editingName, setEditingName] = useState(false);

  // Plate calculator
  const [plateCalcTarget, setPlateCalcTarget] = useState<{ exIdx: number; setIdx: number } | null>(null);

  const saveExerciseEdits = async (exIdx: number) => {
    if (!params.logId) return;
    try {
      await supabase
        .from('workout_logs')
        .update({ exercises: editableExercises })
        .eq('id', params.logId);
    } catch {}
    animateLayout();
    setEditingExIdx(null);
  };

  const cancelExerciseEdits = () => {
    // Revert the edited exercise back to original
    if (editingExIdx != null) {
      setEditableExercises((prev) => {
        const copy = [...prev];
        copy[editingExIdx] = exercises[editingExIdx];
        return copy;
      });
    }
    animateLayout();
    setEditingExIdx(null);
  };

  const saveWorkoutName = async () => {
    if (!params.logId) return;
    try {
      await supabase
        .from('workout_logs')
        .update({ day_name: workoutName.trim() })
        .eq('id', params.logId);
    } catch {}
    setEditingName(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, marginRight: 8 }}>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: '700',
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
                value={workoutName}
                onChangeText={setWorkoutName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveWorkoutName}
              />
              <Pressable onPress={saveWorkoutName} hitSlop={8}>
                <Ionicons name="checkmark-circle" size={24} color={SemanticColors.success} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => params.logId ? setEditingName(true) : undefined}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                {workoutName}
              </Text>
              {params.logId && (
                <Ionicons name="pencil" size={14} color={theme.chrome} />
              )}
            </Pressable>
          )}
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
            {completedDate}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shareable session card — tap to view workout summary */}
        <Pressable
          onPress={() => router.push({
            pathname: '/workout/post-workout',
            params: {
              exercises: params.exercises ?? '[]',
              dayName: params.dayName ?? '',
              focus: params.focus ?? params.dayName ?? '',
              durationMinutes: params.durationMinutes ?? '0',
            },
          })}
        >
          <View
            ref={sessionCardRef}
            collapsable={false}
            style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}
          >
            {/* Header row: workout name + muscle tags */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{params.focus ?? params.dayName ?? 'Workout'}</Text>
              <MuscleGroupPills categories={getExerciseCategories(exercises)} size="small" />
            </View>
            {/* Hero volume */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 36 }}>
                {sessionVolume > 0 ? formatNumber(Math.round(sessionVolume)) : '\u2014'}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{weightUnit === 'lbs' ? 'pounds' : 'kg'} moved</Text>
            </View>
            {/* Stats row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{sessionTotalSets}</Text>
                <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>sets</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{sessionTotalReps}</Text>
                <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>reps</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{durationMinutes}m</Text>
                <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>time</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Exercises */}
        {editableExercises.map((logged, exIdx) => {
          const isExpanded = activeExercise === 'all' || activeExercise === exIdx;
          const isBW = isBodyweightExercise(logged.name);
          const allSetsComplete = logged?.sets.every((s) => s.completed) ?? false;
          const isEditing = editingExIdx === exIdx;

          return (
            <View
              key={exIdx}
              style={{
                marginBottom: 8,
                borderRadius: 14,
                backgroundColor: isExpanded ? theme.surface : 'transparent',
                borderWidth: isExpanded ? 1 : 0,
                borderColor: theme.border,
                padding: isExpanded ? 10 : 0,
                paddingVertical: isExpanded ? 10 : 4,
                paddingHorizontal: isExpanded ? 10 : 4,
              }}
            >
              <Pressable
                onPress={() => {
                  animateLayout();
                  if (activeExercise === 'all') {
                    // Collapse to only this card
                    setActiveExercise(exIdx);
                  } else {
                    setActiveExercise(isExpanded ? null : exIdx);
                  }
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isExpanded ? 8 : 0 }}
              >
                {/* Exercise number indicator */}
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: theme.textSecondary,
                  marginRight: 10,
                  minWidth: 16,
                  textAlign: 'center',
                }}>
                  {exIdx + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                    {logged.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                    {logged.sets.length} sets
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.chrome}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>

              {isExpanded && (
                <>
                  {/* Set rows */}
                  {logged?.sets.map((set, setIdx) => (
                    <View
                      key={setIdx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor: set.completed ? theme.surface : theme.background,
                        borderWidth: 1,
                        borderColor: theme.border,
                      }}
                    >
                      {/* Set number */}
                      <Text style={{ width: 24, fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
                        {setIdx + 1}
                      </Text>

                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {!isBW && (
                          <>
                            <View style={{ flex: 1 }}>
                              {isEditing ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <TextInput
                                    style={{
                                      flex: 1,
                                      backgroundColor: theme.background,
                                      borderRadius: 8,
                                      borderWidth: 1,
                                      borderColor: theme.border,
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                      fontSize: 14,
                                      fontWeight: '600',
                                      color: theme.text,
                                    }}
                                    keyboardType="decimal-pad"
                                    value={set.weight != null ? String(set.weight) : ''}
                                    placeholder="0"
                                    placeholderTextColor={theme.textSecondary}
                                    onChangeText={(val) => {
                                      setEditableExercises((prev) => {
                                        const copy = JSON.parse(JSON.stringify(prev));
                                        copy[exIdx].sets[setIdx].weight = val === '' ? null : parseFloat(val) || 0;
                                        return copy;
                                      });
                                    }}
                                  />
                                  {isBarbell(logged.name) && (
                                    <Pressable onPress={() => setPlateCalcTarget({ exIdx, setIdx })} hitSlop={6} style={{ marginLeft: 6 }}>
                                      <Ionicons name="calculator-outline" size={16} color={theme.chrome} />
                                    </Pressable>
                                  )}
                                </View>
                              ) : (
                                <Pressable
                                  onPress={() => params.logId ? setEditingExIdx(exIdx) : undefined}
                                  style={{
                                    backgroundColor: theme.surface,
                                    borderRadius: 8,
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                  }}
                                >
                                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                                    {set.weight != null ? `${set.weight} ${unitLabel}` : '\u2014'}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                            <View style={{ width: 1, height: 24, backgroundColor: theme.border }} />
                          </>
                        )}

                        <View style={{ flex: 1 }}>
                          {isEditing ? (
                            <TextInput
                              style={{
                                backgroundColor: theme.background,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: theme.border,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                fontSize: 14,
                                fontWeight: '600',
                                color: theme.text,
                              }}
                              keyboardType="decimal-pad"
                              value={String(set.reps)}
                              placeholder="0"
                              placeholderTextColor={theme.textSecondary}
                              onChangeText={(val) => {
                                setEditableExercises((prev) => {
                                  const copy = JSON.parse(JSON.stringify(prev));
                                  copy[exIdx].sets[setIdx].reps = parseInt(val) || 0;
                                  return copy;
                                });
                              }}
                            />
                          ) : (
                            <Pressable
                              onPress={() => params.logId ? setEditingExIdx(exIdx) : undefined}
                              style={{
                                backgroundColor: theme.surface,
                                borderRadius: 8,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>
                                {set.reps > 0 ? `${set.reps} reps` : '\u2014'}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      </View>

                    </View>
                  ))}

                  {/* Save / Cancel buttons for edit mode */}
                  {isEditing && (
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 8 }}>
                      <Pressable
                        onPress={cancelExerciseEdits}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 8,
                          alignItems: 'center',
                          backgroundColor: theme.background,
                          borderWidth: 1,
                          borderColor: theme.border,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => saveExerciseEdits(exIdx)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 8,
                          alignItems: 'center',
                          backgroundColor: SemanticColors.success,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>Save</Text>
                      </Pressable>
                    </View>
                  )}

                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom bar: Frozen timer */}
      <View style={{
        backgroundColor: theme.background,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: 32,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: '700',
          color: theme.text,
          fontVariant: ['tabular-nums'],
          letterSpacing: 1,
        }}>
          {formatTime(durationSeconds)}
        </Text>
        <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
          {params.focus ?? 'Workout'} · Completed
        </Text>
      </View>
      <PlateCalculatorSheet
        visible={plateCalcTarget !== null}
        onClose={() => setPlateCalcTarget(null)}
        onConfirm={(weight) => {
          if (plateCalcTarget) {
            setEditableExercises((prev) => {
              const copy = JSON.parse(JSON.stringify(prev));
              copy[plateCalcTarget.exIdx].sets[plateCalcTarget.setIdx].weight = weight;
              return copy;
            });
          }
        }}
        initialWeight={
          plateCalcTarget
            ? editableExercises[plateCalcTarget.exIdx]?.sets[plateCalcTarget.setIdx]?.weight
            : null
        }
        exerciseName={plateCalcTarget ? editableExercises[plateCalcTarget.exIdx]?.name : undefined}
      />
    </SafeAreaView>
  );
}
