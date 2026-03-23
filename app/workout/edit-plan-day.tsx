import { useCallback, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { EXERCISE_DATABASE, EXERCISE_CATEGORIES } from '@/lib/exercise-data';
import { getInstructions } from '@/lib/exercise-data';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';
import { animateLayout, stripParens } from '@/lib/utils';
import { Exercise } from '@/lib/types';
import { useUserStore } from '@/lib/user-store';

export default function EditPlanDayScreen() {
  const router = useRouter();
  const { dayIdx, dayName, focus, exercises: exercisesJson } = useLocalSearchParams<{
    dayIdx: string;
    dayName: string;
    focus: string;
    exercises: string;
  }>();

  const { plan, refetch } = usePlan();
  const { theme } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);

  const initialExercises: Exercise[] = exercisesJson ? JSON.parse(exercisesJson) : [];
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [saving, setSaving] = useState(false);
  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});
  const [reorderMode, setReorderMode] = useState(false);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingExIdx, setEditingExIdx] = useState<number | null>(null);
  const [editingSets, setEditingSets] = useState('');
  const [editingReps, setEditingReps] = useState('');
  const swipeableRefs = useRef<Record<number, Swipeable | null>>({});

  const groupedByCategory = EXERCISE_CATEGORIES
    .filter((cat) => activeFilters.size === 0 || activeFilters.has(cat))
    .map((cat) => ({
      category: cat,
      exercises: EXERCISE_DATABASE.filter((e) =>
        e.category === cat &&
        e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
        !exercises.some((le) => le.name.toLowerCase() === e.name.toLowerCase())
      ),
    }))
    .filter((g) => g.exercises.length > 0);

  const addExercise = useCallback((name: string) => {
    const newEx: Exercise = { name, sets: 3, reps: '8', rest: '60s' };
    setExercises((prev) => [...prev, newEx]);
    setAddExerciseOpen(false);
    setExerciseSearch('');
    animateLayout();
  }, []);

  const removeExercise = useCallback((exIdx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));
    animateLayout();
  }, []);

  const startEditSetsReps = useCallback((exIdx: number) => {
    const ex = exercises[exIdx];
    setEditingExIdx(exIdx);
    setEditingSets(String(ex.sets));
    setEditingReps(String(ex.reps));
  }, [exercises]);

  const finishEditSetsReps = useCallback(() => {
    if (editingExIdx === null) return;
    const sets = parseInt(editingSets, 10) || 3;
    const reps = editingReps || '8';
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === editingExIdx ? { ...ex, sets, reps } : ex
      )
    );
    setEditingExIdx(null);
    animateLayout();
  }, [editingExIdx, editingSets, editingReps]);

  const handleSave = useCallback(async () => {
    if (!plan || dayIdx === undefined) return;

    setSaving(true);
    try {
      const dayIdxNum = parseInt(dayIdx, 10);
      const newPlan = {
        ...plan,
        weeklyPlan: plan.weeklyPlan.map((day, i) =>
          i === dayIdxNum ? { ...day, exercises } : day
        ),
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        setSaving(false);
        return;
      }

      await supabase
        .from('workout_plans')
        .update({ plan: newPlan })
        .eq('id', plan.id)
        .eq('user_id', user.id);

      refetch();
      router.back();
    } catch (err) {
      console.error('Failed to save plan day:', err);
      Alert.alert('Error', 'Failed to save changes');
      setSaving(false);
    }
  }, [plan, dayIdx, exercises, refetch, router]);

  const renderRightActions = (exIdx: number) => () => (
    <Pressable
      onPress={() => removeExercise(exIdx)}
      style={{
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: 16,
        marginBottom: 12,
        marginLeft: 8,
      }}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header — matches session screen style */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }} numberOfLines={1}>
            {stripParens(focus)}
          </Text>
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 1 }}>
            {exercises.length} exercises · {dayName}
          </Text>
        </View>
        <MuscleGroupPills categories={getExerciseCategories(exercises)} size="small" />
      </View>

      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        <DraggableFlatList
          data={exercises}
          scrollEnabled
          keyExtractor={(item, index) => `${item.name}-${index}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          onDragEnd={({ data }) => {
            setExercises(data);
            animateLayout();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<Exercise>) => {
            const exIdx = getIndex()!;
            const isExpanded = reorderMode ? false : activeExercise === exIdx;
            const detailsOpen = expandedDetails[exIdx] ?? false;
            const instructions = getInstructions(item.name);
            const isEditing = editingExIdx === exIdx;

            return (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {reorderMode && (
                  <Pressable
                    onPressIn={drag}
                    style={{ paddingRight: 8, paddingVertical: 12 }}
                  >
                    <Ionicons name="menu" size={22} color={theme.chrome} />
                  </Pressable>
                )}
                <View style={{ flex: 1, opacity: isActive ? 0.85 : 1 }}>
                <Swipeable
                  ref={(ref) => { swipeableRefs.current[exIdx] = ref; }}
                  renderRightActions={renderRightActions(exIdx)}
                  overshootRight={false}
                  friction={2}
                  enabled={exercises.length > 1}
                >
                  <View
                    style={{
                      marginBottom: 12,
                      borderRadius: 16,
                      backgroundColor: isExpanded ? theme.surface : 'transparent',
                      borderWidth: isExpanded ? 1 : 0,
                      borderColor: theme.border,
                      paddingTop: 12,
                      paddingBottom: 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (isEditing) finishEditSetsReps();
                        animateLayout();
                        setActiveExercise(isExpanded ? null : exIdx);
                      }}
                      onLongPress={() => {
                        if (!reorderMode) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setReorderMode(true);
                          setActiveExercise(null);
                          animateLayout();
                        }
                      }}
                      disabled={isActive}
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isExpanded ? 12 : 0 }}
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
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                          {item.sets} sets · {item.reps} reps{item.rest ? ` · ${item.rest} rest` : ''}
                        </Text>
                      </View>
                      {isExpanded && exercises.length > 1 && (
                        <Pressable onPress={() => removeExercise(exIdx)} hitSlop={8} style={{ padding: 4, marginLeft: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
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
                        {/* Form tips toggle */}
                        <Pressable
                          onPress={() => {
                            animateLayout();
                            setExpandedDetails((prev) => ({ ...prev, [exIdx]: !prev[exIdx] }));
                          }}
                          style={{ paddingTop: 2, paddingBottom: 8 }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '500', color: theme.textSecondary }}>
                            {detailsOpen ? 'Hide tips ↑' : 'Form tips ↓'}
                          </Text>
                        </Pressable>

                        {detailsOpen && instructions && (
                          <View style={{
                            backgroundColor: theme.background,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: theme.border,
                          }}>
                            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>
                              {instructions}
                            </Text>
                          </View>
                        )}

                        {/* Editable sets/reps row */}
                        <View style={{
                          backgroundColor: theme.background,
                          borderRadius: 12,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: theme.border,
                          marginBottom: 8,
                        }}>
                          {isEditing ? (
                            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>Sets</Text>
                                <TextInput
                                  style={{
                                    backgroundColor: theme.surface,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    color: theme.text,
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    textAlign: 'center',
                                  }}
                                  keyboardType="number-pad"
                                  value={editingSets}
                                  onChangeText={setEditingSets}
                                  autoFocus
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>Reps</Text>
                                <TextInput
                                  style={{
                                    backgroundColor: theme.surface,
                                    borderRadius: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    fontSize: 16,
                                    fontWeight: '700',
                                    color: theme.text,
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    textAlign: 'center',
                                  }}
                                  keyboardType="number-pad"
                                  value={editingReps}
                                  onChangeText={setEditingReps}
                                />
                              </View>
                              <Pressable
                                onPress={finishEditSetsReps}
                                style={{
                                  width: 40, height: 40, borderRadius: 10,
                                  backgroundColor: theme.text, alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="checkmark" size={20} color={theme.background} />
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => startEditSetsReps(exIdx)}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                <View style={{ alignItems: 'center' }}>
                                  <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{item.sets}</Text>
                                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>sets</Text>
                                </View>
                                <Text style={{ fontSize: 18, color: theme.textSecondary }}>×</Text>
                                <View style={{ alignItems: 'center' }}>
                                  <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{item.reps}</Text>
                                  <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>reps</Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="create-outline" size={16} color={theme.chrome} />
                                <Text style={{ fontSize: 12, color: theme.chrome, fontWeight: '500' }}>Edit</Text>
                              </View>
                            </Pressable>
                          )}
                        </View>

                        {/* Rest time */}
                        {item.rest && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                            <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{item.rest} rest between sets</Text>
                          </View>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 4 }}>
                            <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                            <Text style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }}>{item.notes}</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                </Swipeable>
                </View>
              </View>
            );
          }}
          ListFooterComponent={() => (
            <View style={{ gap: 10 }}>
              {/* Add Exercise */}
              <Pressable
                onPress={() => setAddExerciseOpen(true)}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="add-circle-outline" size={20} color={theme.chrome} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.chrome }}>Add Exercise</Text>
                </View>
              </Pressable>

              {/* Reorder toggle */}
              {exercises.length > 1 && (
                <Pressable
                  onPress={() => {
                    animateLayout();
                    setReorderMode(!reorderMode);
                    if (reorderMode) setActiveExercise(null);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: reorderMode ? theme.text : theme.border,
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: reorderMode ? theme.text : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name={reorderMode ? 'checkmark' : 'swap-vertical'} size={20} color={reorderMode ? theme.background : theme.chrome} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: reorderMode ? theme.background : theme.chrome }}>
                      {reorderMode ? 'Done Reordering' : 'Reorder Exercises'}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          )}
        />
      </GestureHandlerRootView>

      {/* Save button — fixed at bottom */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        backgroundColor: theme.background,
      }}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: avatarColor ?? '#F59E0B',
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>
      </View>

      {/* Add Exercise Modal */}
      <Modal visible={addExerciseOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: theme.background,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}>
            <Pressable
              onPress={() => {
                setAddExerciseOpen(false);
                setExerciseSearch('');
              }}
              hitSlop={12}
              style={{ padding: 4, marginRight: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, flex: 1 }}>
              Add Exercise
            </Text>
          </View>

          <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              paddingHorizontal: 12,
            }}>
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
              <TextInput
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 16, color: theme.text }}
                placeholder="Search exercises..."
                placeholderTextColor={theme.textSecondary}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {exerciseSearch.length > 0 && (
                <Pressable onPress={() => setExerciseSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  animateLayout();
                  setShowFilterMenu(!showFilterMenu);
                }}
                hitSlop={8}
                style={{ paddingLeft: 8 }}
              >
                <Ionicons name="filter" size={18} color={activeFilters.size > 0 ? '#F59E0B' : theme.textSecondary} />
              </Pressable>
            </View>
            {showFilterMenu && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {EXERCISE_CATEGORIES.filter((cat) => cat !== 'Cardio').map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        animateLayout();
                        setActiveFilters((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat)) next.delete(cat);
                          else next.add(cat);
                          return next;
                        });
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: activeFilters.has(cat) ? theme.text : theme.surface,
                        borderWidth: 1,
                        borderColor: activeFilters.has(cat) ? theme.text : theme.border,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: activeFilters.has(cat) ? theme.background : theme.textSecondary }}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {groupedByCategory.map(({ category, exercises: catExercises }) => {
              const isSearching = exerciseSearch.trim().length > 0;
              const isCatExpanded = isSearching || expandedCategories.has(category);
              return (
                <View key={category} style={{ marginBottom: 12 }}>
                  <Pressable
                    onPress={() => {
                      animateLayout();
                      setExpandedCategories((prev) => {
                        const next = new Set(prev);
                        if (next.has(category)) next.delete(category);
                        else next.add(category);
                        return next;
                      });
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={isCatExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={16}
                        color={theme.chrome}
                      />
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: theme.chrome,
                        textTransform: 'uppercase',
                        letterSpacing: 1.5,
                      }}>
                        {category}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{catExercises.length}</Text>
                  </Pressable>
                  {isCatExpanded && catExercises.map((ex) => (
                    <Pressable
                      key={ex.name}
                      onPress={() => addExercise(ex.name)}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginBottom: 4,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500' }}>{ex.name}</Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{ex.category}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color={theme.chrome} />
                    </Pressable>
                  ))}
                </View>
              );
            })}
            {groupedByCategory.length === 0 && (
              <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                No exercises found
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
