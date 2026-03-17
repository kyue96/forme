import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';

import { usePlan } from '@/lib/plan-context';
import { useCustomExerciseStore } from '@/lib/custom-exercise-store';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { SetRow, SetRowKeyboardAccessory } from '@/components/SetRow';
import { LoggedExercise, LoggedSet } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';
import { isBodyweightExercise, getInstructions, EXERCISE_DATABASE } from '@/lib/exercise-data';
import { formatTimeMs, formatTime, animateLayout } from '@/lib/utils';
import { getWarmupForFocus } from '@/lib/warmup-data';


export default function WorkoutScreen() {
  const { dayIndex } = useLocalSearchParams<{ dayIndex: string }>();
  const router = useRouter();
  const { plan } = usePlan();
  const { weightUnit, restTimerEnabled, restTimerDuration, theme } = useSettings();

  const {
    activeWorkout,
    startWorkout,
    updateExercises,
    setWarmupDone: storeSetWarmupDone,
    pauseWorkout,
    resumeWorkout,
    clearWorkout,
    getElapsedMs,
  } = useWorkoutStore();

  const dayIdx = parseInt(dayIndex ?? '0', 10);
  const day = plan?.weeklyPlan[dayIdx];

  const exercises = day?.exercises.filter(
    (ex) => !ex.name.toLowerCase().startsWith('warm-up') && !ex.name.toLowerCase().startsWith('warmup') && !ex.name.toLowerCase().includes('warm up')
  ) ?? [];

  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>(() => {
    const aw = activeWorkout;
    if (aw?.dayIndex === dayIdx && (aw?.loggedExercises?.length ?? 0) > 0) {
      return aw.loggedExercises;
    }
    return exercises.map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({
        weight: null,
        reps: 0,
        completed: false,
      })),
    }));
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

  const { exercises: customExercises, loaded: customLoaded, load: loadCustomExercises } = useCustomExerciseStore();


  // Rest timer state — integrated into main timer
  const [restRemaining, setRestRemaining] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startedRef = useRef(false);
  const swipeableRefs = useRef<Record<number, Swipeable | null>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});

  const warmupAnim = useRef(new Animated.Value(1)).current;

  const dismissWarmup = () => {
    Animated.timing(warmupAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      storeSetWarmupDone(true);
    });
  };

  const warmupDone = activeWorkout?.warmupDone ?? false;
  const isPaused = activeWorkout?.isPaused ?? false;
  const isResting = restRemaining > 0;

  // Timer display update
  useEffect(() => {
    const id = setInterval(() => setDisplayMs(getElapsedMs()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { loadPreviousSets(); }, []);
  useEffect(() => { if (!customLoaded) loadCustomExercises(); }, []);

  // Start workout — timer starts PAUSED
  useEffect(() => {
    if (!day || startedRef.current) return;
    startedRef.current = true;
    if (activeWorkout?.dayIndex === dayIdx) return;
    const initial: LoggedExercise[] = exercises.map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({
        weight: null,
        reps: 0,
        completed: false,
      })),
    }));
    startWorkout(dayIdx, day.dayName, day.focus, initial);
    setLoggedExercises(initial);
    // Start paused
    setTimeout(() => pauseWorkout(), 50);
  }, [day]);

  useEffect(() => {
    if (loggedExercises.length > 0) {
      updateExercises(loggedExercises);
    }
  }, [loggedExercises]);

  const activeWorkoutRef = useRef(activeWorkout);
  useEffect(() => { activeWorkoutRef.current = activeWorkout; }, [activeWorkout]);

  useFocusEffect(useCallback(() => {
    // Don't auto-resume on focus if we just started paused
    if (startedRef.current) {
      const aw = activeWorkoutRef.current;
      if (aw?.isPaused && aw.elapsedMs > 0) resumeWorkout();
    }
    return () => {
      const aw = activeWorkoutRef.current;
      if (aw && !aw.isPaused) pauseWorkout();
    };
  }, []));

  // Auto-expand first exercise after warmup
  useEffect(() => {
    if (warmupDone && activeExercise === null) {
      animateLayout();
      setActiveExercise(0);
    }
  }, [warmupDone]);

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


  // Start rest timer (yellow timer + haptics on end)
  const startRestTimer = () => {
    if (!restTimerEnabled) return;
    // Clear existing rest timer if any
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

  // Cleanup rest timer on unmount
  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  const handleExit = () => {
    skipRestTimer();
    if (activeWorkout) {
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

  if (!day) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 16, textAlign: 'center' }}>Workout not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>← Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const updateSet = (exIdx: number, setIdx: number, data: LoggedSet) => {
    // Auto-start clock on first data entry
    if (!workoutStarted && (data.weight !== null || data.reps > 0)) {
      setWorkoutStarted(true);
      setCountdown(null);
      resumeWorkout();
    }
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
      // Find superset partner
      const partnerIdx = loggedExercises.findIndex((ex, i) =>
        i !== exIdx && ex.supersetGroupId === currentGroupId
      );
      if (partnerIdx !== -1) {
        const isFirstOfPair = exIdx < partnerIdx;
        // First of pair → focus partner's same set; Second → focus first's next set
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
      // Tag both with supersetGroupId
      const tagged = prev.map((ex, i) =>
        i === first || i === second ? { ...ex, supersetGroupId: groupId } : ex
      );
      // If already adjacent, no reorder needed
      if (second === first + 1) return tagged;
      // Move second exercise to right after first
      const secondEx = tagged[second];
      const without = tagged.filter((_, i) => i !== second);
      // Insert after first (first index is still valid since second > first)
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

  const addExercise = (name: string) => {
    animateLayout();
    const newEx: LoggedExercise = {
      name,
      sets: [{ weight: null, reps: 0, completed: false }],
    };
    setLoggedExercises((prev) => [...prev, newEx]);
    setAddExerciseOpen(false);
    setExerciseSearch('');
    // Expand the newly added exercise
    setTimeout(() => {
      setActiveExercise(loggedExercises.length);
    }, 100);
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
      if (user && plan) {
        await supabase.from('workout_logs').insert({
          user_id: user.id,
          plan_id: plan.id,
          day_name: day.dayName,
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
          dayName: day.dayName,
          focus: day.focus,
          durationMinutes: String(durationMinutes),
        },
      });
    }
  };

  // Current exercise index (first with incomplete sets)
  const currentExIdx = loggedExercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // Filter exercises for add modal
  const filteredExercises = EXERCISE_DATABASE.filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
    !loggedExercises.some((le) => le.name.toLowerCase() === e.name.toLowerCase())
  );

  // Swipeable render — swipe left to reveal image + trash buttons
  const renderRightActions = (exIdx: number) => () => (
    <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
      <View
        style={{
          backgroundColor: theme.chrome,
          justifyContent: 'center',
          alignItems: 'center',
          width: 60,
          borderRadius: 16,
          marginBottom: 12,
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
          justifyContent: 'center',
          alignItems: 'center',
          width: 60,
          borderRadius: 16,
          marginBottom: 12,
        }}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SetRowKeyboardAccessory />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header bar: [Exercise Name + "Exercise X of Y"] ... [+] [Pause] [X] */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }} numberOfLines={1}>
              {day.focus}
            </Text>
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
                {/* Exit — no confirmation */}
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          ListHeaderComponent={
            !warmupDone ? (
              <Animated.View style={{
                marginBottom: 20,
                backgroundColor: theme.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: warmupAnim,
                transform: [{
                  translateY: warmupAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-80, 0],
                  }),
                }],
              }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
                  Warmup — 5 min
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                  Get your blood flowing before lifting.
                </Text>
                {getWarmupForFocus(day?.focus ?? '').map((w, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.chrome, marginRight: 10 }} />
                    <Text style={{ fontSize: 14, color: theme.text, flex: 1 }}>{w.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>{w.duration}</Text>
                  </View>
                ))}
                <Pressable
                  onPress={dismissWarmup}
                  style={{
                    backgroundColor: theme.text,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                >
                  <Text style={{ color: theme.background, fontWeight: '600', fontSize: 14 }}>
                    Done with warmup
                  </Text>
                </Pressable>
              </Animated.View>
            ) : null
          }
          renderItem={({ item: logged, getIndex, drag, isActive }: RenderItemParams<LoggedExercise>) => {
            const exIdx = getIndex()!;
            const exercise = exercises[exIdx];
            const isExpanded = reorderMode ? false : activeExercise === exIdx;
            const detailsOpen = expandedDetails[exIdx] ?? false;
            const suggested = getSuggestedWeight(logged.name);
            const instructions = getInstructions(logged.name);
            const isBW = isBodyweightExercise(logged.name);
            const allSetsComplete = logged?.sets.every((s) => s.completed) ?? false;
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
                  <View
                    style={{
                      marginBottom: isInSuperset && !isLastOfSuperset ? 0 : 12,
                      borderRadius: 16,
                      backgroundColor: isExpanded ? theme.surface : 'transparent',
                      borderWidth: isExpanded ? 1 : 0,
                      borderColor: theme.border,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                    }}
                  >
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
                          {logged.sets.length} sets{exercise ? ` · ${exercise.reps} reps` : ''}
                        </Text>
                        {suggested != null && (
                          <Text style={{ fontSize: 12, color: theme.chrome, marginTop: 2 }}>
                            Suggested: {suggested} {unitLabel} based on last session
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
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.chrome}
                        style={{ marginLeft: 8 }}
                      />
                    </Pressable>

                    {isExpanded && (
                      <>
                        {/* Form tips toggle — above sets */}
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
                          <View style={{
                            backgroundColor: theme.background,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 8,
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
                              Form Tips
                            </Text>
                            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>
                              {instructions}
                            </Text>
                          </View>
                        )}

                        {/* Set rows */}
                        {logged?.sets.map((set, setIdx) => {
                          const isLast = setIdx === (logged?.sets.length ?? 1) - 1;
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

                        {/* Add Set / Add Dropset */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 32 }}>
              {/* Play / Pause — left aligned, no circle */}
              <Pressable
                onPress={() => {
                  if (!workoutStarted) {
                    // Start countdown 3..2..1
                    setCountdown(3);
                    const countdownInterval = setInterval(() => {
                      setCountdown((prev) => {
                        if (prev === null || prev <= 1) {
                          clearInterval(countdownInterval);
                          setWorkoutStarted(true);
                          setCountdown(null);
                          resumeWorkout();
                          return null;
                        }
                        return prev - 1;
                      });
                    }, 1000);
                    return;
                  }
                  if (isPaused) resumeWorkout();
                  else pauseWorkout();
                }}
                hitSlop={12}
                style={{ padding: 8 }}
              >
                <Ionicons
                  name={(!workoutStarted || isPaused) ? 'play' : 'pause'}
                  size={24}
                  color={theme.text}
                />
              </Pressable>

              {/* Timer — centered, tappable for START */}
              <Pressable
                onPress={() => {
                  if (!workoutStarted && countdown === null) {
                    setCountdown(3);
                    const countdownInterval = setInterval(() => {
                      setCountdown((prev) => {
                        if (prev === null || prev <= 1) {
                          clearInterval(countdownInterval);
                          setWorkoutStarted(true);
                          setCountdown(null);
                          resumeWorkout();
                          return null;
                        }
                        return prev - 1;
                      });
                    }, 1000);
                  }
                }}
                disabled={workoutStarted || countdown !== null}
                style={{ flex: 1, alignItems: 'center' }}
              >
                <Text style={{
                  fontSize: 24,
                  fontWeight: '700',
                  color: countdown !== null ? SemanticColors.warning : (isPaused ? theme.chrome : theme.text),
                  fontVariant: ['tabular-nums'],
                  letterSpacing: 1,
                }}>
                  {countdown !== null ? String(countdown) : (!workoutStarted ? 'START' : formatTimeMs(displayMs))}
                </Text>
                {workoutStarted && countdown === null && (
                  <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>
                    {isPaused ? 'Paused' : day.focus}
                  </Text>
                )}
              </Pressable>

              {/* Finish — right aligned, two-tap confirm */}
              <Pressable
                onPress={() => {
                  if (confirmFinish) {
                    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                    setConfirmFinish(false);
                    handleFinish();
                  } else {
                    setConfirmFinish(true);
                    confirmTimerRef.current = setTimeout(() => setConfirmFinish(false), 3000);
                  }
                }}
                hitSlop={12}
                style={{ padding: 8 }}
                disabled={saving}
              >
                <Ionicons
                  name={confirmFinish ? 'checkmark' : 'flag'}
                  size={24}
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
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
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
                  fontSize: 16,
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
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
                    onPress={() => addExercise(ce.name)}
                    style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <View>
                      <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500' }}>{ce.name}</Text>
                      <Text style={{ fontSize: 13, color: theme.chrome, marginTop: 2 }}>{ce.muscleGroup} · Custom</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={theme.chrome} />
                  </Pressable>
                ))}
              {filteredExercises.map((exercise, i) => (
                <Pressable
                  key={i}
                  onPress={() => addExercise(exercise.name)}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 16, color: theme.text, fontWeight: '500' }}>{exercise.name}</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>{exercise.category}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={theme.chrome} />
                </Pressable>
              ))}
              {filteredExercises.length === 0 && (
                <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                  No exercises found
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
