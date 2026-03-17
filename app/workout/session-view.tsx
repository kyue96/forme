import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { LoggedExercise } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';
import { isBodyweightExercise, getInstructions } from '@/lib/exercise-data';
import { formatTime, animateLayout } from '@/lib/utils';
import { isBarbell } from '@/lib/plate-calculator';
import { PlateCalculatorSheet } from '@/components/PlateCalculatorSheet';

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

  const exercises: LoggedExercise[] = params.exercises ? JSON.parse(params.exercises) : [];
  const durationMinutes = parseInt(params.durationMinutes ?? '0', 10);
  const durationSeconds = durationMinutes * 60;
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  const completedDate = params.completedAt
    ? new Date(params.completedAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  // Editable exercises (Step 13)
  const [editableExercises, setEditableExercises] = useState<LoggedExercise[]>(exercises);
  const [editingExIdx, setEditingExIdx] = useState<number | null>(null);

  // Editable workout name (Step 14)
  const [workoutName, setWorkoutName] = useState(params.dayName ?? 'Workout');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, marginRight: 12 }}>
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
            {params.focus ?? ''} {completedDate ? `· ${completedDate}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Exercises */}
        {editableExercises.map((logged, exIdx) => {
          const isExpanded = activeExercise === exIdx;
          const detailsOpen = expandedDetails[exIdx] ?? false;
          const instructions = getInstructions(logged.name);
          const isBW = isBodyweightExercise(logged.name);
          const allSetsComplete = logged?.sets.every((s) => s.completed) ?? false;
          const isEditing = editingExIdx === exIdx;

          return (
            <View
              key={exIdx}
              style={{
                marginBottom: 12,
                borderRadius: 16,
                backgroundColor: isExpanded ? theme.surface : 'transparent',
                borderWidth: isExpanded ? 1 : 0,
                borderColor: theme.border,
                padding: isExpanded ? 12 : 0,
                paddingVertical: isExpanded ? 12 : 4,
                paddingHorizontal: isExpanded ? 12 : 4,
              }}
            >
              <Pressable
                onPress={() => {
                  animateLayout();
                  setActiveExercise(isExpanded ? null : exIdx);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isExpanded ? 12 : 0 }}
              >
                {/* Exercise number indicator */}
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: allSetsComplete ? SemanticColors.success : SemanticColors.warning,
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
                    {logged.sets.length} sets · {logged.sets.filter(s => s.completed).length} completed
                  </Text>
                </View>
                {isExpanded && params.logId && !isEditing && (
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setEditingExIdx(exIdx);
                    }}
                    hitSlop={8}
                    style={{ marginLeft: 8 }}
                  >
                    <Ionicons name="pencil" size={16} color={theme.chrome} />
                  </Pressable>
                )}
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
                        marginBottom: 8,
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: set.completed ? theme.surface : theme.background,
                        borderWidth: 1,
                        borderColor: set.completed ? '#22C55E' : theme.border,
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
                                      paddingHorizontal: 10,
                                      paddingVertical: 8,
                                      fontSize: 16,
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
                                <View style={{
                                  backgroundColor: theme.surface,
                                  borderRadius: 8,
                                  paddingHorizontal: 10,
                                  paddingVertical: 8,
                                }}>
                                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                                    {set.weight != null ? `${set.weight} ${unitLabel}` : '\u2014'}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={{ width: 1, height: 32, backgroundColor: theme.border }} />
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
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                fontSize: 16,
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
                            <View style={{
                              backgroundColor: theme.surface,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                            }}>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                                {set.reps > 0 ? `${set.reps} reps` : '\u2014'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Completion indicator */}
                      <View style={{
                        marginLeft: 12,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: set.completed ? '#22C55E' : 'transparent',
                        borderWidth: set.completed ? 0 : 2,
                        borderColor: '#EAB308',
                      }}>
                        {set.completed && <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{'\u2713'}</Text>}
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

                  {/* Exercise instructions toggle */}
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setExpandedDetails((prev) => ({ ...prev, [exIdx]: !prev[exIdx] }));
                    }}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary }}>
                      {detailsOpen ? 'Hide instructions \u2191' : 'How to perform \u2193'}
                    </Text>
                  </Pressable>

                  {detailsOpen && (
                    <View style={{
                      backgroundColor: theme.background,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 4,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: theme.chrome,
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}>
                        Instructions
                      </Text>
                      <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>
                        {instructions}
                      </Text>
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
      />
    </SafeAreaView>
  );
}
