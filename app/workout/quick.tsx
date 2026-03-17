import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { useCustomExerciseStore, CustomExercise } from '@/lib/custom-exercise-store';
import { SetRow } from '@/components/SetRow';
import { BottomSheet } from '@/components/BottomSheet';
import { LoggedExercise, LoggedSet } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';
import {
  EXERCISE_DATABASE,
  EXERCISE_CATEGORIES,
  isBodyweightExercise,
  getInstructions,
} from '@/lib/exercise-data';
import { formatTimeMs, formatTime, animateLayout } from '@/lib/utils';

type Phase = 'pick' | 'workout';


export default function QuickWorkoutScreen() {
  const router = useRouter();
  const { weightUnit, restTimerEnabled, restTimerDuration, theme } = useSettings();

  const {
    activeWorkout,
    startWorkout,
    updateExercises,
    pauseWorkout,
    resumeWorkout,
    clearWorkout,
    getElapsedMs,
  } = useWorkoutStore();

  const [phase, setPhase] = useState<Phase>(() => {
    if (activeWorkout?.dayIndex === -1) return 'workout';
    return 'pick';
  });

  // --- Exercise picker state ---
  const [search, setSearch] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [workoutName, setWorkoutName] = useState(activeWorkout?.dayName ?? 'My Workout');
  const [editingName, setEditingName] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // --- Workout state ---
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>(() => {
    if (activeWorkout?.dayIndex === -1 && (activeWorkout?.loggedExercises?.length ?? 0) > 0) {
      return activeWorkout.loggedExercises;
    }
    return [];
  });
  const [previousSets, setPreviousSets] = useState<Record<string, LoggedSet[]>>({});
  const [displayMs, setDisplayMs] = useState(0);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});
  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [addExerciseOpen, setAddExerciseOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [supersetMode, setSupersetMode] = useState(false);
  const [selectedForSuperset, setSelectedForSuperset] = useState<number[]>([]);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { exercises: customExercises, loaded: customLoaded, load: loadCustomExercises, create: createCustomExercise } = useCustomExerciseStore();
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('Chest');
  const [customEquipment, setCustomEquipment] = useState('');

  // Rest timer state
  const [restRemaining, setRestRemaining] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startedRef = useRef(false);
  const swipeableRefs = useRef<Record<number, Swipeable | null>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const isPaused = activeWorkout?.isPaused ?? false;
  const isResting = restRemaining > 0;

  // Timer tick
  useEffect(() => {
    if (phase !== 'workout') return;
    const id = setInterval(() => setDisplayMs(getElapsedMs()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => { loadPreviousSets(); }, []);
  useEffect(() => { if (!customLoaded) loadCustomExercises(); }, []);

  useEffect(() => {
    if (phase === 'workout' && loggedExercises.length > 0) {
      updateExercises(loggedExercises);
    }
  }, [loggedExercises, phase]);

  const activeWorkoutRef = useRef(activeWorkout);
  useEffect(() => { activeWorkoutRef.current = activeWorkout; }, [activeWorkout]);

  useFocusEffect(useCallback(() => {
    const aw = activeWorkoutRef.current;
    if (aw?.isPaused && aw.elapsedMs > 0 && phase === 'workout') resumeWorkout();
    return () => {
      const aw = activeWorkoutRef.current;
      if (aw && !aw.isPaused && phase === 'workout') pauseWorkout();
    };
  }, [phase]));

  // Cleanup rest timer
  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  const loadPreviousSets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('exercises')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(5);
      if (!logs) return;
      const prevMap: Record<string, LoggedSet[]> = {};
      for (const log of logs) {
        const exs = log.exercises as LoggedExercise[];
        for (const ex of exs) {
          if (!prevMap[ex.name]) prevMap[ex.name] = ex.sets;
        }
      }
      setPreviousSets(prevMap);
    } catch {}
  };

  const getSuggestedWeight = (exerciseName: string): number | null => {
    if (isBodyweightExercise(exerciseName)) return null;
    const prev = previousSets[exerciseName];
    if (!prev || prev.length === 0) return null;
    const completedSets = prev.filter((s) => s.completed && s.weight != null);
    if (completedSets.length === 0) return null;
    const lastWeight = completedSets[0].weight!;
    const lastReps = completedSets[0].reps;
    if (lastReps > 12) return Math.round((lastWeight * 1.05) / 2.5) * 2.5;
    if (lastReps < 6) return Math.round((lastWeight * 0.9) / 2.5) * 2.5;
    return lastWeight;
  };


  const startRestTimer = () => {
    if (!restTimerEnabled) return;
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestRemaining(restTimerDuration);
    restIntervalRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          if (restIntervalRef.current) clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipRestTimer = () => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;
    setRestRemaining(0);
  };

  // --- Exercise picker logic ---
  const filteredExercises = search.trim()
    ? EXERCISE_DATABASE.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : EXERCISE_DATABASE;

  const toggleExercise = (name: string) => {
    animateLayout();
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const startQuickWorkout = () => {
    if (selectedNames.length === 0) return;
    const initial: LoggedExercise[] = selectedNames.map((name) => ({
      name,
      sets: [{ weight: null, reps: 0, completed: false }],
    }));
    startWorkout(-1, workoutName.trim() || 'My Workout', 'Custom', initial);
    setLoggedExercises(initial);
    startedRef.current = true;
    setPhase('workout');
    // Start paused
    setTimeout(() => pauseWorkout(), 50);
  };

  // --- Workout logic ---
  const updateSet = (exIdx: number, setIdx: number, data: LoggedSet) => {
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: updated[exIdx].sets.map((s, i) => (i === setIdx ? data : s)),
      };
      return updated;
    });
  };

  const completeSet = (exIdx: number, setIdx: number) => {
    const currentSet = loggedExercises[exIdx].sets[setIdx];
    updateSet(exIdx, setIdx, { ...currentSet, completed: true });
    // Prefill next set's weight if it's still empty
    const nextSet = loggedExercises[exIdx].sets[setIdx + 1];
    if (nextSet && nextSet.weight == null && currentSet.weight != null) {
      updateSet(exIdx, setIdx + 1, { ...nextSet, weight: currentSet.weight });
    }
    // Auto-advance to next exercise when all sets complete
    const updatedSets = loggedExercises[exIdx].sets.map((s, i) =>
      i === setIdx ? { ...s, completed: true } : s
    );
    const allDone = updatedSets.every((s) => s.completed);
    const currentGroupId = loggedExercises[exIdx].supersetGroupId;

    // Superset alternating focus: A1 → B1 → A2 → B2 → ...
    if (currentGroupId && !allDone) {
      const partnerIdx = loggedExercises.findIndex((ex, i) =>
        i !== exIdx && ex.supersetGroupId === currentGroupId
      );
      if (partnerIdx !== -1) {
        const isFirstOfPair = exIdx < partnerIdx;
        const targetExIdx = isFirstOfPair ? partnerIdx : partnerIdx;
        const targetSetIdx = isFirstOfPair ? setIdx : setIdx + 1;
        const targetSet = loggedExercises[targetExIdx]?.sets[targetSetIdx];

        if (targetSet && !targetSet.completed) {
          animateLayout();
          setActiveExercise(targetExIdx);
          setTimeout(() => {
            const hasWeight = targetSet.weight != null && targetSet.weight > 0;
            const ref = hasWeight
              ? inputRefs.current[`${targetExIdx}-${targetSetIdx}-r`]
              : inputRefs.current[`${targetExIdx}-${targetSetIdx}-w`];
            ref?.focus();
          }, 300);
          return;
        }
      }
    }

    const nextEx = loggedExercises[exIdx + 1];
    const isSupersetTransition = allDone && currentGroupId && nextEx?.supersetGroupId === currentGroupId;

    if (isSupersetTransition) {
      // Skip rest timer, advance to superset partner immediately
      animateLayout();
      setActiveExercise(exIdx + 1);
    } else {
      startRestTimer();
      if (allDone && exIdx + 1 < loggedExercises.length) {
        setTimeout(() => {
          animateLayout();
          setActiveExercise(exIdx + 1);
        }, 300);
      }
    }
  };

  const addSet = (exIdx: number) => {
    animateLayout();
    setLoggedExercises((prev) => {
      const updated = [...prev];
      const lastSet = updated[exIdx].sets[updated[exIdx].sets.length - 1];
      const newSetIdx = updated[exIdx].sets.length;
      updated[exIdx] = {
        ...updated[exIdx],
        sets: [...updated[exIdx].sets, {
          weight: lastSet?.weight ?? null,
          reps: 0,
          completed: false,
        }],
      };
      // Auto-focus new set's reps input
      setTimeout(() => inputRefs.current[`${exIdx}-${newSetIdx}-r`]?.focus(), 100);
      return updated;
    });
  };

  const addDropSet = (exIdx: number) => {
    animateLayout();
    setLoggedExercises((prev) => {
      const updated = [...prev];
      const lastSet = updated[exIdx].sets[updated[exIdx].sets.length - 1];
      const newSetIdx = updated[exIdx].sets.length;
      updated[exIdx] = {
        ...updated[exIdx],
        sets: [...updated[exIdx].sets, {
          weight: lastSet?.weight ? Math.round(lastSet.weight * 0.8 / 2.5) * 2.5 : null,
          reps: 0,
          completed: false,
          isDropSet: true,
        }],
      };
      setTimeout(() => inputRefs.current[`${exIdx}-${newSetIdx}-r`]?.focus(), 100);
      return updated;
    });
  };

  const removeSet = (exIdx: number) => {
    if (loggedExercises[exIdx].sets.length <= 1) return;
    animateLayout();
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: updated[exIdx].sets.slice(0, -1),
      };
      return updated;
    });
  };

  const removeSetAt = (exIdx: number, setIdx: number) => {
    if (loggedExercises[exIdx].sets.length <= 1) return;
    animateLayout();
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: updated[exIdx].sets.filter((_, i) => i !== setIdx),
      };
      return updated;
    });
  };

  const removeExercise = (exIdx: number) => {
    if (loggedExercises.length <= 1) return;
    animateLayout();
    setLoggedExercises((prev) => prev.filter((_, i) => i !== exIdx));
    if (activeExercise === exIdx) setActiveExercise(null);
    else if (activeExercise !== null && activeExercise > exIdx) setActiveExercise(activeExercise - 1);
  };

  const toggleSupersetSelection = (exIdx: number) => {
    setSelectedForSuperset((prev) =>
      prev.includes(exIdx) ? prev.filter((i) => i !== exIdx) : prev.length < 2 ? [...prev, exIdx] : prev
    );
  };

  const confirmSuperset = () => {
    if (selectedForSuperset.length !== 2) return;
    const groupId = String(Date.now());
    const [first, second] = [...selectedForSuperset].sort((a, b) => a - b);
    animateLayout();
    setLoggedExercises((prev) => {
      const tagged = prev.map((ex, i) =>
        i === first || i === second ? { ...ex, supersetGroupId: groupId } : ex
      );
      if (second === first + 1) return tagged;
      const secondEx = tagged[second];
      const without = tagged.filter((_, i) => i !== second);
      without.splice(first + 1, 0, secondEx);
      return without;
    });
    setSelectedForSuperset([]);
    setSupersetMode(false);
  };

  const unlinkSuperset = (exIdx: number) => {
    const groupId = loggedExercises[exIdx].supersetGroupId;
    if (!groupId) return;
    animateLayout();
    setLoggedExercises((prev) =>
      prev.map((ex) =>
        ex.supersetGroupId === groupId ? { ...ex, supersetGroupId: undefined } : ex
      )
    );
  };

  const addExerciseDuringWorkout = (name: string) => {
    animateLayout();
    const newEx: LoggedExercise = { name, sets: [{ weight: null, reps: 0, completed: false }] };
    setLoggedExercises((prev) => [...prev, newEx]);
    setAddExerciseOpen(false);
    setExerciseSearch('');
    setTimeout(() => setActiveExercise(loggedExercises.length), 100);
  };



  const handleFinish = async () => {
    skipRestTimer();
    const allComplete = loggedExercises.every((ex) => ex.sets.every((s) => s.completed));
    if (!allComplete) {
      Alert.alert(
        'Incomplete workout',
        "Some sets haven't been logged yet. Finish anyway?",
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Finish', onPress: saveAndNavigate },
        ]
      );
    } else {
      saveAndNavigate();
    }
  };

  const saveAndNavigate = async () => {
    setSaving(true);
    const durationMinutes = Math.round(getElapsedMs() / 60000);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('workout_logs').insert({
          user_id: user.id,
          plan_id: null,
          day_name: workoutName.trim() || 'My Workout',
          exercises: loggedExercises,
          duration_minutes: durationMinutes,
          completed_at: new Date().toISOString(),
        });
      }
    } catch {} finally {
      setSaving(false);
      clearWorkout();
      router.replace({
        pathname: '/workout/post-workout',
        params: {
          exercises: JSON.stringify(loggedExercises),
          dayName: workoutName.trim() || 'My Workout',
          focus: 'Custom',
          durationMinutes: String(durationMinutes),
        },
      });
    }
  };

  const handleExit = () => {
    skipRestTimer();
    if (phase === 'workout') {
      Alert.alert(
        'Leave workout?',
        'Your progress is saved as a draft. You can resume later.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ],
      );
    } else {
      router.back();
    }
  };

  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // ==================== RENDER ====================

  // Phase 1: Exercise Picker
  if (phase === 'pick') {
    const groupedByCategory = EXERCISE_CATEGORIES.map((cat) => ({
      category: cat,
      exercises: filteredExercises.filter((e) => e.category === cat),
    })).filter((g) => g.exercises.length > 0);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}>
          <Pressable onPress={handleExit} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Choose Exercises</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Workout name */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
          {editingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}
                placeholder="Workout name"
                placeholderTextColor={theme.textSecondary}
                value={workoutName}
                onChangeText={setWorkoutName}
                maxLength={40}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => setEditingName(false)}
              />
              <Pressable onPress={() => setEditingName(false)} hitSlop={8}>
                <Ionicons name="checkmark-circle" size={24} color={theme.text} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setEditingName(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                {workoutName.trim() || 'My Workout'}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={theme.chrome} />
            </Pressable>
          )}
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
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>


        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Create Custom Exercise button */}
          <Pressable
            onPress={() => setShowCreateCustom(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12,
              borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.chrome} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.chrome }}>Create Custom Exercise</Text>
          </Pressable>

          {/* Custom exercises */}
          {customExercises.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                Custom Exercises
              </Text>
              {customExercises
                .filter((ce) => !search.trim() || ce.name.toLowerCase().includes(search.toLowerCase()))
                .map((ce) => {
                  const isSelected = selectedNames.includes(ce.name);
                  return (
                    <Pressable
                      key={ce.id}
                      onPress={() => toggleExercise(ce.name)}
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingVertical: 12, paddingHorizontal: 12, marginBottom: 4, borderRadius: 12,
                        backgroundColor: isSelected ? theme.chrome + '15' : 'transparent',
                        borderWidth: isSelected ? 1 : 0, borderColor: theme.chrome + '30',
                      }}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                        borderColor: isSelected ? SemanticColors.success : theme.border,
                        backgroundColor: isSelected ? SemanticColors.success : 'transparent',
                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                      }}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, color: theme.text, fontWeight: isSelected ? '600' : '400' }}>
                          {ce.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.chrome }}>{ce.muscleGroup} · Custom</Text>
                      </View>
                    </Pressable>
                  );
                })}
            </View>
          )}

          {/* Exercise list */}
          {groupedByCategory
            .map(({ category, exercises: catExercises }) => {
            const isSearching = search.trim().length > 0;
            const isCatExpanded = isSearching || expandedCategories.has(category);
            const selectedInCat = catExercises.filter((e) => selectedNames.includes(e.name)).length;

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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {selectedInCat > 0 && (
                      <View style={{
                        backgroundColor: SemanticColors.success,
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 6,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>{selectedInCat}</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{catExercises.length}</Text>
                  </View>
                </Pressable>
                {isCatExpanded && catExercises.map((ex) => {
                  const isSelected = selectedNames.includes(ex.name);
                  return (
                    <Pressable
                      key={ex.name}
                      onPress={() => toggleExercise(ex.name)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        marginBottom: 4,
                        borderRadius: 12,
                        backgroundColor: isSelected ? theme.chrome + '15' : 'transparent',
                        borderWidth: isSelected ? 1 : 0,
                        borderColor: theme.chrome + '30',
                      }}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected ? SemanticColors.success : theme.border,
                        backgroundColor: isSelected ? SemanticColors.success : 'transparent',
                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                      }}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={{ fontSize: 16, color: theme.text, fontWeight: isSelected ? '600' : '400' }}>
                        {ex.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <View style={{
          paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
          backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
        }}>
          {selectedNames.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {selectedNames.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => toggleExercise(name)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
                    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 13, color: theme.text, marginRight: 4 }}>{name}</Text>
                  <Ionicons name="close" size={12} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            onPress={startQuickWorkout}
            disabled={selectedNames.length === 0}
            style={{
              backgroundColor: selectedNames.length > 0 ? theme.text : theme.surface,
              paddingVertical: 16, borderRadius: 16, alignItems: 'center',
              opacity: selectedNames.length === 0 ? 0.5 : 1,
            }}
          >
            <Text style={{
              color: selectedNames.length > 0 ? theme.background : theme.textSecondary,
              fontWeight: '600', fontSize: 16,
            }}>
              {selectedNames.length === 0
                ? 'Select exercises to start'
                : `Start workout · ${selectedNames.length} exercise${selectedNames.length > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>

        <BottomSheet visible={showCreateCustom} onClose={() => { setShowCreateCustom(false); setCustomName(''); setCustomEquipment(''); }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 }}>Create Custom Exercise</Text>
          <TextInput
            style={{ fontSize: 16, color: theme.text, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }}
            placeholder="Exercise name"
            placeholderTextColor={theme.textSecondary}
            value={customName}
            onChangeText={setCustomName}
            autoFocus
          />
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Muscle Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {EXERCISE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCustomMuscleGroup(cat)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: customMuscleGroup === cat ? theme.text : theme.background,
                    borderWidth: 1, borderColor: customMuscleGroup === cat ? theme.text : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: customMuscleGroup === cat ? theme.background : theme.text }}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <TextInput
            style={{ fontSize: 16, color: theme.text, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}
            placeholder="Equipment (optional)"
            placeholderTextColor={theme.textSecondary}
            value={customEquipment}
            onChangeText={setCustomEquipment}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => { setShowCreateCustom(false); setCustomName(''); setCustomEquipment(''); }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!customName.trim()) return;
                await createCustomExercise(customName.trim(), customMuscleGroup, customEquipment.trim() || undefined);
                setShowCreateCustom(false);
                setCustomName('');
                setCustomEquipment('');
              }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.text }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.background }}>Create</Text>
            </Pressable>
          </View>
        </BottomSheet>
      </SafeAreaView>
    );
  }

  // Phase 2: Active Workout
  const currentExIdx = loggedExercises.findIndex((ex) => ex.sets.some((s) => !s.completed));

  const filteredAddExercises = EXERCISE_DATABASE.filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
    !loggedExercises.some((le) => le.name.toLowerCase() === e.name.toLowerCase())
  );

  const renderRightActions = (exIdx: number) => () => (
    <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
      <View
        style={{
          backgroundColor: theme.chrome,
          justifyContent: 'center', alignItems: 'center',
          width: 60, borderRadius: 16, marginBottom: 12,
        }}
      >
        <Ionicons name="image-outline" size={22} color="#000" />
        <Text style={{ fontSize: 9, color: '#000', marginTop: 2, fontWeight: '600' }}>Soon</Text>
      </View>
      <Pressable
        onPress={() => {
          swipeableRefs.current[exIdx]?.close();
          removeExercise(exIdx);
        }}
        style={{
          backgroundColor: SemanticColors.danger,
          justifyContent: 'center', alignItems: 'center',
          width: 60, borderRadius: 16, marginBottom: 12,
        }}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            {editingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={{ fontSize: 16, fontWeight: '700', color: theme.text, flex: 1, borderBottomWidth: 1, borderBottomColor: theme.chrome, paddingBottom: 2 }}
                  value={workoutName}
                  onChangeText={setWorkoutName}
                  maxLength={40}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => setEditingName(false)}
                />
                <Pressable onPress={() => setEditingName(false)} hitSlop={8}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.text} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                  {workoutName.trim() || 'My Workout'}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={theme.chrome} />
              </Pressable>
            )}
            <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
              Exercise {currentExIdx >= 0 ? currentExIdx + 1 : loggedExercises.length} of {loggedExercises.length}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {reorderMode ? (
              <Pressable
                onPress={() => { setReorderMode(false); animateLayout(); }}
                hitSlop={12}
                style={{ padding: 4 }}
              >
                <Ionicons name="checkmark-circle" size={26} color={SemanticColors.success} />
              </Pressable>
            ) : supersetMode ? (
              <>
                <Pressable
                  onPress={() => { setSupersetMode(false); setSelectedForSuperset([]); }}
                  hitSlop={12}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-outline" size={26} color={theme.chrome} />
                </Pressable>
                {selectedForSuperset.length === 2 && (
                  <Pressable onPress={confirmSuperset} hitSlop={12} style={{ padding: 4 }}>
                    <Ionicons name="checkmark-circle" size={26} color={SemanticColors.success} />
                  </Pressable>
                )}
              </>
            ) : (
              <>
                {/* Link superset */}
                <Pressable onPress={() => { setSupersetMode(true); animateLayout(); }} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="link-outline" size={22} color={theme.chrome} />
                </Pressable>
                {/* Add exercise */}
                <Pressable onPress={() => setAddExerciseOpen(true)} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="add-outline" size={24} color={theme.chrome} />
                </Pressable>
                <Pressable onPress={handleExit} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="close-outline" size={26} color={theme.chrome} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <DraggableFlatList
          data={loggedExercises}
          keyExtractor={(_, i) => String(i)}
          onDragEnd={({ data }) => { setLoggedExercises(data); animateLayout(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: logged, getIndex, drag, isActive }: RenderItemParams<LoggedExercise>) => {
            const exIdx = getIndex()!;
            const isExpanded = reorderMode ? false : activeExercise === exIdx;
            const detailsOpen = expandedDetails[exIdx] ?? false;
            const suggested = getSuggestedWeight(logged.name);
            const instructions = getInstructions(logged.name);
            const isBW = isBodyweightExercise(logged.name);
            const allSetsComplete = logged.sets.every((s) => s.completed);
            const isFirstOfSuperset = logged.supersetGroupId && (exIdx === 0 || loggedExercises[exIdx - 1]?.supersetGroupId !== logged.supersetGroupId);
            const isLastOfSuperset = logged.supersetGroupId && (exIdx === loggedExercises.length - 1 || loggedExercises[exIdx + 1]?.supersetGroupId !== logged.supersetGroupId);
            const isInSuperset = !!logged.supersetGroupId;

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
                {/* Superset vertical connector between exercises */}
                {!isFirstOfSuperset && isInSuperset && !reorderMode && (
                  <View style={{ alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 2, height: 16, backgroundColor: theme.chrome, borderRadius: 1 }} />
                  </View>
                )}
                <Swipeable
                  ref={(ref) => { swipeableRefs.current[exIdx] = ref; }}
                  renderRightActions={renderRightActions(exIdx)}
                  overshootRight={false}
                  friction={2}
                  enabled={loggedExercises.length > 1}
                >
                  <View style={{
                    marginBottom: isInSuperset && !isLastOfSuperset ? 0 : 12,
                    borderRadius: 16,
                    backgroundColor: isExpanded ? theme.surface : 'transparent',
                    borderWidth: isExpanded ? 1 : 0, borderColor: theme.border,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                  }}>
                    <Pressable
                      onPress={() => {
                        animateLayout();
                        setActiveExercise(isExpanded ? null : exIdx);
                      }}
                      onLongPress={() => {
                        if (!reorderMode) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setReorderMode(true);
                          animateLayout();
                        }
                      }}
                      disabled={isActive}
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isExpanded ? 12 : 0 }}
                    >
                      {supersetMode && (
                        <Pressable onPress={() => toggleSupersetSelection(exIdx)} style={{ marginRight: 8 }}>
                          <Ionicons
                            name={selectedForSuperset.includes(exIdx) ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={selectedForSuperset.includes(exIdx) ? theme.chrome : theme.textSecondary}
                          />
                        </Pressable>
                      )}
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
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{logged.name}</Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                          {logged.sets.length} set{logged.sets.length !== 1 ? 's' : ''}
                        </Text>
                        {suggested != null && (
                          <Text style={{ fontSize: 12, color: theme.chrome, marginTop: 2 }}>
                            Suggested: {suggested} {unitLabel}
                          </Text>
                        )}
                      </View>
                      {isExpanded && logged.supersetGroupId && (
                        <Pressable onPress={() => unlinkSuperset(exIdx)} hitSlop={8} style={{ padding: 4, marginLeft: 4 }}>
                          <Ionicons name="git-compare-outline" size={14} color={theme.textSecondary} />
                        </Pressable>
                      )}
                      {isExpanded && loggedExercises.length > 1 && (
                        <Pressable onPress={() => removeExercise(exIdx)} hitSlop={8} style={{ padding: 4, marginLeft: 8 }}>
                          <Ionicons name="trash-outline" size={16} color={SemanticColors.danger} />
                        </Pressable>
                      )}
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.chrome} style={{ marginLeft: 8 }} />
                    </Pressable>

                    {isExpanded && (
                      <>
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
                        {detailsOpen && (
                          <View style={{ backgroundColor: theme.background, borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: theme.border }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.chrome, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Form Tips</Text>
                            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>{instructions}</Text>
                          </View>
                        )}
                        {logged.sets.map((set, setIdx) => {
                          const isLast = setIdx === logged.sets.length - 1;
                          return (
                            <SetRow
                              key={setIdx}
                              setNumber={setIdx + 1}
                              data={set}
                              onChange={(d) => updateSet(exIdx, setIdx, d)}
                              onComplete={() => completeSet(exIdx, setIdx)}
                              onDelete={logged.sets.length > 1 ? () => removeSetAt(exIdx, setIdx) : undefined}
                              isBodyweight={isBW}
                              weightLabel={`Weight (${unitLabel})`}
                              exerciseName={logged.name}
                              isLastSet={isLast}
                              isSuperset={!!logged.supersetGroupId}
                              isDropSet={set.isDropSet}
                              showLabels={setIdx === 0}
                              weightInputRef={(el) => { inputRefs.current[`${exIdx}-${setIdx}-w`] = el; }}
                              repsInputRef={(el) => { inputRefs.current[`${exIdx}-${setIdx}-r`] = el; }}
                              onWeightSubmit={() => inputRefs.current[`${exIdx}-${setIdx}-r`]?.focus()}
                              onRepsSubmit={() => {
                                const nextReps = inputRefs.current[`${exIdx}-${setIdx + 1}-r`];
                                if (nextReps) nextReps.focus();
                              }}
                            />
                          );
                        })}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 }}>
                          <Pressable
                            onPress={() => addSet(exIdx)}
                            style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Add Set</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => addDropSet(exIdx)}
                            style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Add Dropset</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                </Swipeable>
                </View>
              </View>
            );
          }}
        />
        </KeyboardAvoidingView>

        {/* Bottom bar: Timer + Finish */}
        <View style={{ backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border }}>
          {isResting ? (
            <Pressable
              onPress={skipRestTimer}
              style={{ backgroundColor: '#EAB308', paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#000', fontVariant: ['tabular-nums'], letterSpacing: 1 }}>
                {formatTime(restRemaining)}
              </Text>
              <Text style={{ fontSize: 12, color: '#000', opacity: 0.7, marginTop: 2 }}>Tap to skip rest</Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 32, gap: 12 }}>
              {/* Play / Pause */}
              <Pressable
                onPress={() => {
                  if (!workoutStarted && countdown === null) {
                    // First tap: start countdown 3..2..1
                    setCountdown(3);
                    let c = 3;
                    const id = setInterval(() => {
                      c -= 1;
                      if (c > 0) {
                        setCountdown(c);
                      } else {
                        clearInterval(id);
                        setCountdown(null);
                        setWorkoutStarted(true);
                        resumeWorkout();
                      }
                    }, 1000);
                  } else if (isPaused) {
                    resumeWorkout();
                  } else {
                    pauseWorkout();
                  }
                }}
                hitSlop={12}
                style={{ padding: 8 }}
              >
                <Ionicons
                  name={(!workoutStarted || isPaused) ? 'play' : 'pause'}
                  size={26}
                  color={theme.text}
                />
              </Pressable>

              {/* Timer — tappable for START */}
              <Pressable
                onPress={() => {
                  if (!workoutStarted && countdown === null) {
                    setCountdown(3);
                    let c = 3;
                    const id = setInterval(() => {
                      c -= 1;
                      if (c > 0) {
                        setCountdown(c);
                      } else {
                        clearInterval(id);
                        setCountdown(null);
                        setWorkoutStarted(true);
                        resumeWorkout();
                      }
                    }, 1000);
                  }
                }}
                disabled={workoutStarted || countdown !== null}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Text style={{
                  fontSize: 24, fontWeight: '700',
                  color: countdown !== null ? SemanticColors.warning : isPaused ? theme.chrome : theme.text,
                  fontVariant: ['tabular-nums'], letterSpacing: 1,
                }}>
                  {!workoutStarted && countdown === null
                    ? 'START'
                    : countdown !== null
                    ? String(countdown)
                    : formatTimeMs(displayMs)}
                </Text>
              </Pressable>

              {/* Finish (two-tap) */}
              <Pressable
                onPress={() => {
                  if (confirmFinish) {
                    // Second tap: confirm finish
                    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                    confirmTimerRef.current = null;
                    setConfirmFinish(false);
                    handleFinish();
                  } else {
                    // First tap: show confirmation
                    setConfirmFinish(true);
                    confirmTimerRef.current = setTimeout(() => {
                      setConfirmFinish(false);
                      confirmTimerRef.current = null;
                    }, 3000);
                  }
                }}
                hitSlop={12}
                style={{ padding: 8 }}
              >
                <Ionicons
                  name={confirmFinish ? 'checkmark' : 'flag-outline'}
                  size={26}
                  color={confirmFinish ? SemanticColors.success : theme.text}
                />
              </Pressable>
            </View>
          )}
        </View>

        {/* Add exercise modal */}
        <Modal visible={addExerciseOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
                Add Exercise
              </Text>
              <Pressable onPress={() => { setAddExerciseOpen(false); setExerciseSearch(''); }} hitSlop={12}>
                <Ionicons name="close" size={24} color={theme.chrome} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              <TextInput
                style={{
                  fontSize: 16, color: theme.text, backgroundColor: theme.surface,
                  borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                  borderWidth: 1, borderColor: theme.border,
                }}
                placeholder="Search exercises…"
                placeholderTextColor={theme.textSecondary}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                autoFocus
              />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
              {customExercises
                .filter((ce) => ce.name.toLowerCase().includes(exerciseSearch.toLowerCase()) && !loggedExercises.some((le) => le.name.toLowerCase() === ce.name.toLowerCase()))
                .map((ce) => (
                  <Pressable
                    key={ce.id}
                    onPress={() => addExerciseDuringWorkout(ce.name)}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <View>
                      <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500' }}>{ce.name}</Text>
                      <Text style={{ fontSize: 13, color: theme.chrome, marginTop: 2 }}>{ce.muscleGroup} · Custom</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={theme.chrome} />
                  </Pressable>
                ))}
              {filteredAddExercises.map((exercise, i) => (
                <Pressable
                  key={i}
                  onPress={() => addExerciseDuringWorkout(exercise.name)}
                  style={{
                    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500' }}>{exercise.name}</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{exercise.category}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={theme.chrome} />
                </Pressable>
              ))}
              {filteredAddExercises.length === 0 && (
                <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 }}>No exercises found</Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
