import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  AppState,
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
import * as ImagePicker from 'expo-image-picker';

import { usePlan } from '@/lib/plan-context';
import { useCustomExerciseStore } from '@/lib/custom-exercise-store';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { SetRow, SetRowKeyboardAccessory } from '@/components/SetRow';
import { BottomSheet } from '@/components/BottomSheet';
import { LoggedExercise, LoggedSet } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';
import { isBodyweightExercise, getInstructions, EXERCISE_DATABASE, EXERCISE_CATEGORIES } from '@/lib/exercise-data';
import { formatTimeMs, formatTime, animateLayout, animateLayoutSlow } from '@/lib/utils';
import { getWarmupRoutine } from '@/lib/warmup-data';
import { getExerciseImageUrls } from '@/lib/exercise-images';
import { Image as ExpoImage } from 'expo-image';
import { ExerciseThumbnail } from '@/components/ExerciseThumbnail';
import * as Notifications from 'expo-notifications';


export default function WorkoutScreen() {
  const { dayIndex } = useLocalSearchParams<{ dayIndex: string }>();
  const router = useRouter();
  const { plan } = usePlan();
  const { weightUnit, warmupEnabled, restTimerEnabled, restTimerDuration, theme } = useSettings();

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
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const confirmAddDoneRef = useRef(false);
  const [confirmAddDoneTick, setConfirmAddDoneTick] = useState(0);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForSuperset, setSelectedForSuperset] = useState<number[]>([]);
  const [unlinkConfirmIdx, setUnlinkConfirmIdx] = useState<number | null>(null);
  const [warmupChecked, setWarmupChecked] = useState<Record<string, boolean>>({});
  const [warmupCollapsed, setWarmupCollapsed] = useState(() => {
    if (activeWorkout?.warmupDone) return true;
    // Auto-collapse warmup if resuming with at least 1 completed set
    // Auto-collapse warmup if resuming with at least 1 completed set
    if (activeWorkout?.dayIndex === dayIdx && getElapsedMs() > 0 && activeWorkout?.loggedExercises?.some(ex => ex.sets.some(s => s.completed))) return true;
    return false;
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { exercises: customExercises, loaded: customLoaded, load: loadCustomExercises, create: createCustomExercise } = useCustomExerciseStore();
  const [scanning, setScanning] = useState(false);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('Chest');
  const [customEquipment, setCustomEquipment] = useState('');

  // Rest timer state - integrated into main timer
  const [restRemaining, setRestRemaining] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startedRef = useRef(false);
  const isResuming = useRef(activeWorkout?.dayIndex === dayIdx && getElapsedMs() > 0);
  const swipeableRefs = useRef<Record<number, Swipeable | null>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const listRef = useRef<any>(null);

  const warmupAnim = useRef(new Animated.Value(1)).current;

  const warmupAutoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restNotificationIdRef = useRef<string | null>(null);

  // Keep a ref to loggedExercises so the AppState listener always has fresh data
  const loggedExercisesRef = useRef(loggedExercises);
  useEffect(() => { loggedExercisesRef.current = loggedExercises; }, [loggedExercises]);

  // Force-save workout state when app goes to background (covers force-close)
  // Timer keeps running via epoch-based elapsed calculation - no pause/resume needed
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Sync latest local loggedExercises to the store before the OS suspends us
        const current = loggedExercisesRef.current;
        if (current.length > 0) {
          updateExercises(current);
        }
      } else if (nextState === 'active') {
        // Recalculate display immediately when returning to foreground
        setDisplayMs(getElapsedMs());
      }
    });
    return () => sub.remove();
  }, []);

  const dismissWarmup = () => {
    if (warmupAutoDismissRef.current) clearTimeout(warmupAutoDismissRef.current);
    animateLayoutSlow();
    setWarmupCollapsed(true);
  };

  const startFromWarmup = () => {
    // Start the clock but keep warmup card visible
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
    // Auto-dismiss warmup card after 11 minutes
    if (warmupAutoDismissRef.current) clearTimeout(warmupAutoDismissRef.current);
    warmupAutoDismissRef.current = setTimeout(() => {
      dismissWarmup();
    }, 11 * 60 * 1000);
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

  // Start workout - timer starts PAUSED
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
    // Don't auto-resume on focus — user must tap RESUME + countdown
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

  // Auto-collapse warmup when all exercises checked green
  useEffect(() => {
    if (warmupCollapsed) return;
    const warmup = getWarmupRoutine(day?.focus ?? '');
    const totalItems = warmup.cardio.length + warmup.mobility.length;
    const checkedCount = Object.values(warmupChecked).filter(Boolean).length;
    if (totalItems > 0 && checkedCount >= totalItems) {
      const timer = setTimeout(() => {
        dismissWarmup();
        // Focus first exercise, set 1, weight field
        setTimeout(() => {
          setActiveExercise(0);
          animateLayout();
          setTimeout(() => {
            const ref = inputRefs.current['0-0-w'];
            if (ref) ref.focus();
          }, 400);
        }, 350);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [warmupChecked, warmupCollapsed]);

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

    // Determine weight increment based on exercise name
    let increment = 5; // default
    const lower = exerciseName.toLowerCase();
    if (lower.includes('cable') || lower.includes('machine')) {
      increment = 10;
    } else if (lower.includes('dumbbell') || lower.includes('barbell')) {
      increment = 5;
    }

    if (lastReps > 12) return Math.round((lastWeight * 1.05) / increment) * increment;
    if (lastReps < 6) return Math.round((lastWeight * 0.9) / increment) * increment;
    return lastWeight;
  };

  const handleCameraScan = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to scan equipment.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      setScanning(true);

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/identify-machine`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ image: result.assets[0].base64 }),
        }
      );

      const data = await response.json();

      if (data.name) {
        // Pre-fill the custom exercise form with the identified info
        setCustomName(data.name);
        setCustomMuscleGroup(data.muscleGroup || 'Chest');
        setCustomEquipment(data.equipment || '');
        setShowCreateCustom(true);
      } else {
        Alert.alert('Could not identify', 'Unable to identify the equipment. Try taking a clearer photo or create a custom exercise manually.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to scan equipment. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  // --- Notification helpers ---
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  };

  const scheduleRestNotification = async (seconds: number) => {
    try {
      await requestNotificationPermissions();
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest Timer',
          body: 'Rest is over.',
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
      });
      restNotificationIdRef.current = id;
    } catch {}
  };

  const cancelRestNotification = async () => {
    if (restNotificationIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(restNotificationIdRef.current);
      } catch {}
      restNotificationIdRef.current = null;
    }
  };

  // Start rest timer (yellow timer + haptics on end)
  const startRestTimer = (manual = false) => {
    if (!manual && !restTimerEnabled) return;
    // Clear existing rest timer if any
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    cancelRestNotification();

    setRestRemaining(restTimerDuration);
    scheduleRestNotification(restTimerDuration);
    restIntervalRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          if (restIntervalRef.current) clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          restNotificationIdRef.current = null; // Already fired
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
    cancelRestNotification();
  };

  // Cleanup rest timer on unmount
  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  const handleRestart = () => {
    if (!confirmRestart) {
      setConfirmRestart(true);
      // Auto-reset after 3 seconds if not confirmed
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => setConfirmRestart(false), 3000);
      return;
    }
    // Second tap - restart
    setConfirmRestart(false);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    const initial: LoggedExercise[] = exercises.map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({
        weight: null,
        reps: 0,
        completed: false,
      })),
    }));
    clearWorkout();
    startWorkout(dayIdx, day!.dayName, day!.focus, initial);
    setLoggedExercises(initial);
    setWorkoutStarted(false);
    setCountdown(null);
    setConfirmFinish(false);
    setActiveExercise(0);
    skipRestTimer();
    // Reset warmup
    setWarmupCollapsed(false);
    setWarmupChecked({});
    storeSetWarmupDone(false);
    warmupAnim.setValue(1);
    setTimeout(() => pauseWorkout(), 50);
  };

  const handleDiscard = () => {
    if (!confirmDiscard) {
      setConfirmDiscard(true);
      if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
      discardTimerRef.current = setTimeout(() => setConfirmDiscard(false), 3000);
      return;
    }
    // Second tap - discard
    setConfirmDiscard(false);
    if (discardTimerRef.current) clearTimeout(discardTimerRef.current);
    skipRestTimer();
    clearWorkout();
    router.back();
  };

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

  // Scroll expanded card to top of visible area
  const scrollToExercise = (exIdx: number) => {
    setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: exIdx, animated: true, viewOffset: 0 });
      } catch {}
    }, 350);
  };

  const updateSet = (exIdx: number, setIdx: number, data: LoggedSet) => {
    // Auto-start clock on first data entry
    if (!workoutStarted && (data.weight !== null || data.reps > 0)) {
      setWorkoutStarted(true);
      setCountdown(null);
      resumeWorkout();
    }
    setLoggedExercises((prev) => {
      const updated = [...prev];
      const oldSet = updated[exIdx].sets[setIdx];
      const weightChanged = data.weight !== oldSet.weight && data.weight !== null;
      const newSets = updated[exIdx].sets.map((s, i) => (i === setIdx ? data : s));

      // Auto-flow weight forward to subsequent unfilled sets (no reps entered yet)
      if (weightChanged) {
        for (let i = setIdx + 1; i < newSets.length; i++) {
          if (newSets[i].reps === 0 && !newSets[i].completed) {
            newSets[i] = { ...newSets[i], weight: data.weight };
          }
        }
      }

      updated[exIdx] = { ...updated[exIdx], sets: newSets };
      return updated;
    });
  };

  // Auto-complete filled-but-unchecked sets when collapsing an exercise card
  const autoCompleteSetsOnCollapse = (exIdx: number) => {
    const exercise = loggedExercises[exIdx];
    if (!exercise) return;
    const isBW = isBodyweightExercise(exercise.name);
    let anyChanged = false;
    const updatedSets = exercise.sets.map((s) => {
      if (s.completed) return s;
      const hasWeight = isBW || (s.weight != null && s.weight > 0);
      const hasReps = s.reps > 0;
      if (hasWeight && hasReps) {
        anyChanged = true;
        return { ...s, completed: true };
      }
      return s;
    });
    if (anyChanged) {
      setLoggedExercises((prev) => {
        const updated = [...prev];
        updated[exIdx] = { ...updated[exIdx], sets: updatedSets };
        return updated;
      });
    }
  };

  const completeSet = (exIdx: number, setIdx: number) => {
    const currentSet = loggedExercises[exIdx].sets[setIdx];
    updateSet(exIdx, setIdx, { ...currentSet, completed: true });
    // Smart weight suggestion for next set based on current set's reps
    const nextSet = loggedExercises[exIdx].sets[setIdx + 1];
    if (nextSet && currentSet.weight != null) {
      let suggestedWeight = currentSet.weight;
      const weightStep = weightUnit === 'lbs' ? 5 : 2.5;

      // Apply smart suggestions based on rep range
      if (currentSet.reps < 5) {
        // Low reps: decrease weight by one plate
        suggestedWeight = Math.max(0, currentSet.weight - weightStep);
      } else if (currentSet.reps > 12) {
        // High reps: increase weight by one plate
        suggestedWeight = currentSet.weight + weightStep;
      }
      // Otherwise (5-12 reps): keep same weight

      // Prefill weight if still empty, otherwise set as suggestion
      if (nextSet.weight == null) {
        updateSet(exIdx, setIdx + 1, { ...nextSet, weight: suggestedWeight, suggestedWeight });
      } else {
        updateSet(exIdx, setIdx + 1, { ...nextSet, suggestedWeight });
      }
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
    scrollToExercise(exIdx);
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

  const linkSelectedSuperset = (idxA: number, idxB: number) => {
    const groupId = String(Date.now());
    animateLayout();
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[idxA] = { ...updated[idxA], supersetGroupId: groupId };
      updated[idxB] = { ...updated[idxB], supersetGroupId: groupId };
      return updated;
    });
    setSelectionMode(false);
    setSelectedForSuperset([]);
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

  // Group exercises by category for add modal
  const groupedByCategory = EXERCISE_CATEGORIES
    .filter((cat) => activeFilters.size === 0 || activeFilters.has(cat))
    .map((cat) => ({
      category: cat,
      exercises: EXERCISE_DATABASE.filter((e) =>
        e.category === cat &&
        e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
        !loggedExercises.some((le) => le.name.toLowerCase() === e.name.toLowerCase())
      ),
    })).filter((g) => g.exercises.length > 0);

  // Swipeable render - swipe left to reveal image + trash buttons
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
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
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
            ) : selectionMode ? (
              <Pressable
                onPress={() => {
                  if (selectedForSuperset.length === 2) {
                    linkSelectedSuperset(selectedForSuperset[0], selectedForSuperset[1]);
                  } else {
                    setSelectionMode(false);
                    setSelectedForSuperset([]);
                    animateLayout();
                  }
                }}
                hitSlop={12}
                style={{ padding: 4 }}
              >
                <Ionicons name="checkmark-circle" size={26} color={SemanticColors.success} />
              </Pressable>
            ) : (
              <>
                {/* Superset link */}
                <Pressable onPress={() => { setSelectionMode(true); animateLayout(); }} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="link-outline" size={22} color={theme.chrome} />
                </Pressable>
                {/* Add exercise */}
                <Pressable onPress={() => setAddExerciseOpen(true)} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="add-outline" size={24} color={theme.chrome} />
                </Pressable>
                {/* Restart - two-tap confirm */}
                <Pressable onPress={handleRestart} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="refresh-outline" size={22} color={confirmRestart ? SemanticColors.danger : theme.chrome} />
                </Pressable>
                {/* Discard - two-tap confirm */}
                <Pressable onPress={handleDiscard} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={20} color={confirmDiscard ? SemanticColors.danger : theme.chrome} />
                </Pressable>
                {/* Exit */}
                <Pressable onPress={handleExit} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="close-outline" size={26} color={theme.chrome} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <DraggableFlatList
          ref={listRef}
          data={loggedExercises}
          keyExtractor={(_, i) => String(i)}
          onDragEnd={({ data }) => { setLoggedExercises(data); animateLayout(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => { if (unlinkConfirmIdx !== null) setUnlinkConfirmIdx(null); }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          ListHeaderComponent={(() => {
            if (!warmupEnabled) return null;
            const warmup = getWarmupRoutine(day?.focus ?? '');
            const totalItems = warmup.cardio.length + warmup.mobility.length;
            const checkedCount = Object.values(warmupChecked).filter(Boolean).length;
            const allWarmupDone = totalItems > 0 && checkedCount >= totalItems;
            const anySetCompleted = loggedExercises.some(ex => ex.sets.some(s => s.completed));

            if (warmupCollapsed) {
              // Collapsed: tappable bar to re-expand
              return (
                <Pressable
                  onPress={() => { animateLayoutSlow(); setWarmupCollapsed(false); }}
                  style={{
                    marginBottom: 12,
                    backgroundColor: theme.surface,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: theme.text,
                      textDecorationLine: (!allWarmupDone && anySetCompleted) ? 'line-through' : 'none',
                    }}>Warm-Up</Text>
                    <Text style={{ fontSize: 12, color: allWarmupDone ? SemanticColors.success : theme.textSecondary }}>
                      {checkedCount}/{totalItems}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </Pressable>
              );
            }

            // Expanded: full warmup card
            return (
              <View style={{
                marginBottom: 20,
                backgroundColor: theme.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: theme.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                    Warm-Up · 10 min
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Pressable onPress={startFromWarmup} disabled={workoutStarted} hitSlop={8} style={{ backgroundColor: workoutStarted ? theme.chrome : theme.text, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>{workoutStarted ? 'In progress' : 'Start'}</Text>
                    </Pressable>
                    <Pressable onPress={() => { dismissWarmup(); }} hitSlop={8}>
                      <Ionicons name="chevron-up" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                  Get your blood flowing before lifting.
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Cardio · 5 min
                </Text>
                {warmup.cardio.map((w, i) => {
                  const key = `c-${i}`;
                  const done = warmupChecked[key] ?? false;
                  return (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: done ? SemanticColors.success : theme.chrome, marginRight: 10 }} />
                      <Text style={{ fontSize: 14, color: done ? theme.textSecondary : theme.text, flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}>{w.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginRight: 10 }}>{w.duration}</Text>
                      <Pressable onPress={() => setWarmupChecked((prev) => ({ ...prev, [key]: !prev[key] }))} hitSlop={6}>
                        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? SemanticColors.success : theme.border} />
                      </Pressable>
                    </View>
                  );
                })}
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 8 }}>
                  Dynamic Stretching · 5 min
                </Text>
                {warmup.mobility.map((w, i) => {
                  const key = `m-${i}`;
                  const done = warmupChecked[key] ?? false;
                  return (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: done ? SemanticColors.success : theme.chrome, marginRight: 10 }} />
                      <Text style={{ fontSize: 14, color: done ? theme.textSecondary : theme.text, flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}>{w.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginRight: 10 }}>{w.duration}</Text>
                      <Pressable onPress={() => setWarmupChecked((prev) => ({ ...prev, [key]: !prev[key] }))} hitSlop={6}>
                        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? SemanticColors.success : theme.border} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })()}
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
                {selectionMode && (
                  <Pressable
                    onPress={() => {
                      setSelectedForSuperset((prev) => {
                        if (prev.includes(exIdx)) return prev.filter((i) => i !== exIdx);
                        if (prev.length >= 2) return prev;
                        return [...prev, exIdx];
                      });
                    }}
                    hitSlop={8}
                    style={{ paddingRight: 10, paddingVertical: 12 }}
                  >
                    <Ionicons
                      name={selectedForSuperset.includes(exIdx) ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selectedForSuperset.includes(exIdx) ? SemanticColors.success : theme.textSecondary}
                    />
                  </Pressable>
                )}
                <View style={{ flex: 1, opacity: isActive ? 0.85 : 1 }}>
                {/* Superset vertical connector - left-aligned under exercise number */}
                {!isFirstOfSuperset && isInSuperset && !reorderMode && (
                  <Pressable
                    onPress={() => {
                      if (unlinkConfirmIdx === exIdx) {
                        unlinkSuperset(exIdx);
                        setUnlinkConfirmIdx(null);
                      } else {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setUnlinkConfirmIdx(exIdx);
                      }
                    }}
                    hitSlop={16}
                    style={{ width: 24, marginRight: 10, alignItems: 'center', paddingVertical: 4, marginLeft: 8 }}
                  >
                    <Ionicons
                      name="link"
                      size={16}
                      color={unlinkConfirmIdx === exIdx ? SemanticColors.danger : theme.chrome}
                      style={{ transform: [{ rotate: '90deg' }] }}
                    />
                  </Pressable>
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
                      paddingTop: isInSuperset && !isFirstOfSuperset ? 4 : 12,
                      paddingBottom: isInSuperset && !isLastOfSuperset ? 4 : 12,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        if (isExpanded) {
                          autoCompleteSetsOnCollapse(exIdx);
                        } else if (activeExercise !== null) {
                          // Collapsing the previously active exercise
                          autoCompleteSetsOnCollapse(activeExercise);
                        }
                        animateLayout();
                        setActiveExercise(isExpanded ? null : exIdx);
                        if (!isExpanded) scrollToExercise(exIdx);
                        if (unlinkConfirmIdx !== null) setUnlinkConfirmIdx(null);
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
                      {/* Exercise number indicator */}
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: allSetsComplete ? SemanticColors.success : theme.textSecondary,
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
                      {/* Info icon - navigate to exercise detail */}
                      <ExerciseThumbnail exerciseName={logged.name} theme={theme} />
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
                        {/* Form tips toggle - above sets */}
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


        {/* Bottom bar: Play | Timer + Rest | Finish - single row */}
        <View style={{ backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28 }}>
          <View style={{ position: 'relative', height: 36 }}>
            {/* Timer - absolutely centered, never moves */}
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
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{
                fontSize: 22,
                fontWeight: '700',
                color: countdown !== null ? SemanticColors.warning : (isPaused ? theme.chrome : theme.text),
                fontVariant: ['tabular-nums'],
                letterSpacing: 1,
              }}>
                {countdown !== null ? String(countdown) : (!workoutStarted ? (isResuming.current ? 'RESUME' : 'START') : formatTimeMs(displayMs))}
              </Text>
            </Pressable>

            {/* Left/right controls on top of timer */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 }}>
              {/* Play / Pause */}
              <Pressable
                onPress={() => {
                  if (!workoutStarted) {
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
                  size={22}
                  color={theme.text}
                />
              </Pressable>

              {/* Finish - two-tap confirm (right edge) */}
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
                  size={22}
                  color={confirmFinish ? SemanticColors.success : theme.text}
                />
              </Pressable>
            </View>

            {/* Rest timer pill - absolutely positioned between clock and finish, only when workout started */}
            {workoutStarted && <Pressable
              onPress={() => {
                if (isResting) {
                  skipRestTimer();
                } else {
                  startRestTimer(true);
                }
              }}
              hitSlop={8}
              style={{
                position: 'absolute',
                right: 50,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isResting ? '#EAB30825' : theme.surface,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isResting ? '#EAB30850' : theme.border,
              }}>
                {isResting ? (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#EAB308', fontVariant: ['tabular-nums'] }}>
                    {formatTime(restRemaining)}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5 }}>
                    REST
                  </Text>
                )}
              </View>
            </Pressable>}
          </View>
        </View>

        {/* Add exercise modal */}
        <Modal visible={addExerciseOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: theme.background,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>
                Add Exercise
              </Text>
              <Pressable
                onPress={() => {
                  if (confirmAddDoneRef.current) {
                    confirmAddDoneRef.current = false;
                    setAddExerciseOpen(false);
                    setExerciseSearch('');
                  } else {
                    confirmAddDoneRef.current = true;
                    setTimeout(() => { confirmAddDoneRef.current = false; setConfirmAddDoneTick((t) => t + 1); }, 3000);
                    setConfirmAddDoneTick((t) => t + 1);
                  }
                }}
                hitSlop={12}
              >
                <Ionicons
                  name={confirmAddDoneRef.current ? 'checkmark-circle' : 'checkmark'}
                  size={26}
                  color={confirmAddDoneRef.current ? '#22C55E' : theme.chrome}
                />
              </Pressable>
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
                  placeholder="Search exercises…"
                  placeholderTextColor={theme.textSecondary}
                  value={exerciseSearch}
                  onChangeText={setExerciseSearch}
                  autoFocus
                />
                {exerciseSearch.length > 0 && (
                  <Pressable onPress={() => setExerciseSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => { animateLayout(); setShowFilterMenu(!showFilterMenu); }}
                  hitSlop={8}
                  style={{ paddingLeft: 8 }}
                >
                  <Ionicons name="filter" size={18} color={activeFilters.size > 0 ? '#F59E0B' : theme.textSecondary} />
                </Pressable>
              </View>
              {showFilterMenu && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {EXERCISE_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => { animateLayout(); setActiveFilters((prev) => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; }); }}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                          backgroundColor: activeFilters.has(cat) ? theme.text : theme.surface,
                          borderWidth: 1, borderColor: activeFilters.has(cat) ? theme.text : theme.border,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: activeFilters.has(cat) ? theme.background : theme.textSecondary }}>{cat}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Camera + Custom buttons */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 }}>
                <Pressable
                  onPress={handleCameraScan}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    paddingVertical: 12,
                    borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                  }}
                >
                  <Ionicons name="camera-outline" size={20} color={theme.chrome} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.chrome }}>Camera</Text>
                </Pressable>
              </View>

              {scanning && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <ActivityIndicator size="small" color={theme.chrome} />
                  <Text style={{ fontSize: 13, color: theme.textSecondary }}>Identifying equipment...</Text>
                </View>
              )}
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

        {/* Custom Exercise Modal */}
        <BottomSheet visible={showCreateCustom} onClose={() => { setShowCreateCustom(false); setCustomName(''); setCustomEquipment(''); }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 }}>Custom Exercise</Text>
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
                addExercise(customName.trim());
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
    </GestureHandlerRootView>
  );
}
