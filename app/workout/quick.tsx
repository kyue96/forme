import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { playRestTimerChime } from '@/lib/rest-timer-sound';
import { useWorkoutStore } from '@/lib/workout-store';
import { useCustomExerciseStore, CustomExercise } from '@/lib/custom-exercise-store';
import { SetRow, SetRowKeyboardAccessory } from '@/components/SetRow';
import { BottomSheet } from '@/components/BottomSheet';
import { LoggedExercise, LoggedSet } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';
import {
  EXERCISE_DATABASE,
  EXERCISE_CATEGORIES,
  EQUIPMENT_TYPES,
  CABLE_ATTACHMENTS,
  isCableExercise,
  isBodyweightExercise,
  getInstructions,
  getAttachmentsForExercise,
} from '@/lib/exercise-data';
import { formatTimeMs, formatTime, animateLayout, animateLayoutSlow, stripParens } from '@/lib/utils';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';
import { getWarmupRoutine } from '@/lib/warmup-data';
import { useUserStore } from '@/lib/user-store';
import { getExerciseImageUrls } from '@/lib/exercise-images';
import { detectAndSavePRs } from '@/lib/pr-detection';
import { preloadIncrements, getExerciseIncrementSync, updateIncrementsAfterWorkout } from '@/lib/exercise-increments';
import { Image as ExpoImage } from 'expo-image';
import { ExerciseThumbnail } from '@/components/ExerciseThumbnail';
import * as Notifications from 'expo-notifications';

type Phase = 'pick' | 'workout';


export default function QuickWorkoutScreen() {
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const { weightUnit, warmupEnabled, restTimerEnabled, restTimerSound, restTimerDuration, theme } = useSettings();

  const {
    activeWorkout,
    startWorkout,
    updateExercises,
    pauseWorkout,
    resumeWorkout,
    clearWorkout,
    getElapsedMs,
    setWarmupDone: storeSetWarmupDone,
  } = useWorkoutStore();

  const avatarColor = useUserStore((s) => s.avatarColor) ?? '#F59E0B';
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [phase, setPhase] = useState<Phase>(() => {
    if (activeWorkout?.dayIndex === -1) return 'workout';
    return 'pick';
  });

  // --- Exercise picker state ---
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [workoutName, setWorkoutName] = useState(activeWorkout?.dayName ?? 'My Workout');
  const [editingName, setEditingName] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const confirmAddDoneRef = useRef(false);
  const [confirmAddDoneTick, setConfirmAddDoneTick] = useState(0);

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
  const [workoutStarted, setWorkoutStarted] = useState(() => activeWorkout?.dayIndex === -1 && getElapsedMs() > 0);
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
    // Auto-collapse if resuming an active workout (timer was running)
    if (activeWorkout?.dayIndex === -1 && getElapsedMs() > 0) return true;
    return false;
  });
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { exercises: customExercises, loaded: customLoaded, load: loadCustomExercises, create: createCustomExercise } = useCustomExerciseStore();
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscleGroup, setCustomMuscleGroup] = useState('Chest');
  const [customEquipment, setCustomEquipment] = useState('Barbell');
  const [scanning, setScanning] = useState(false);

  // Saved routines
  interface SavedRoutine { id: string; name: string; exercises: { name: string; sets: number; reps: string }[]; last_used_at: string; }
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>([]);
  const [savedRoutinesLoaded, setSavedRoutinesLoaded] = useState(false);
  const activeRoutineRef = useRef<SavedRoutine | null>(null);

  // Rest timer state - epoch-based so it survives app backgrounding
  const [restStartEpoch, setRestStartEpoch] = useState<number | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startedRef = useRef(false);
  const isResuming = useRef(activeWorkout?.dayIndex === -1 && getElapsedMs() > 0);
  const swipeableRefs = useRef<Record<number, Swipeable | null>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const listRef = useRef<any>(null);
  const warmupAutoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restNotificationIdRef = useRef<string | null>(null);

  // Adaptive increment tracking
  const sessionDeltasRef = useRef<Record<string, number[]>>({});
  const [incrementsReady, setIncrementsReady] = useState(false);
  useEffect(() => { preloadIncrements().then(() => setIncrementsReady(true)); }, []);

  const recordWeightDelta = useCallback((exerciseName: string, delta: number) => {
    const key = exerciseName;
    if (!sessionDeltasRef.current[key]) sessionDeltasRef.current[key] = [];
    sessionDeltasRef.current[key].push(delta);
  }, []);

  const isPaused = activeWorkout?.isPaused ?? false;
  const isResting = restRemaining > 0;
  const warmupDone = activeWorkout?.warmupDone ?? false;

  // Keep a ref to loggedExercises so the AppState listener always has fresh data
  const loggedExercisesRef = useRef(loggedExercises);
  useEffect(() => { loggedExercisesRef.current = loggedExercises; }, [loggedExercises]);

  // Force-save workout state when app goes to background (covers force-close)
  // Timer keeps running via epoch-based elapsed calculation - no pause/resume needed
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // Dismiss keyboard immediately to prevent layout reflow on return
        Keyboard.dismiss();
        // Sync latest local loggedExercises to the store before the OS suspends us
        const current = loggedExercisesRef.current;
        if (current.length > 0) {
          updateExercises(current);
        }
      } else if (nextState === 'active') {
        // Recalculate display immediately when returning to foreground
        setDisplayMs(getElapsedMs());
        // Recalculate rest timer — epoch-based so elapsed time is correct
        const epoch = restStartEpochRef.current;
        if (epoch) {
          const elapsed = Math.floor((Date.now() - epoch) / 1000);
          const remaining = Math.max(0, restTimerDuration - elapsed);
          setRestRemaining(remaining);
          if (remaining <= 0) {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
            restIntervalRef.current = null;
            setRestStartEpoch(null);
          }
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Timer tick
  useEffect(() => {
    if (phase !== 'workout') return;
    const id = setInterval(() => setDisplayMs(getElapsedMs()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => { loadPreviousSets(); }, []);
  useEffect(() => { if (!customLoaded) loadCustomExercises(); }, []);

  // Load saved routines
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('saved_routines')
          .select('id, name, exercises, last_used_at')
          .eq('user_id', user.id)
          .order('last_used_at', { ascending: false })
          .limit(20);
        if (data) setSavedRoutines(data as SavedRoutine[]);
      } catch {} finally {
        setSavedRoutinesLoaded(true);
      }
    })();
  }, []);

  // Pre-fill exercises when navigating from a saved routine
  const routineConsumed = useRef(false);
  useEffect(() => {
    if (routineId && !routineConsumed.current && savedRoutinesLoaded && phase === 'pick') {
      routineConsumed.current = true;
      const match = savedRoutines.find(r => r.id === routineId);
      if (match) {
        const names = match.exercises.map((e: any) => e.name);
        setSelectedNames(names);
        setWorkoutName(match.name);
        activeRoutineRef.current = match;
        setShowNamePrompt(true);
      }
    }
  }, [routineId, savedRoutinesLoaded, savedRoutines, phase]);

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

  // --- Warm-up helpers ---
  const dismissWarmup = () => {
    if (warmupAutoDismissRef.current) clearTimeout(warmupAutoDismissRef.current);
    animateLayoutSlow();
    setWarmupCollapsed(true);
  };

  const startFromWarmup = () => {
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
    if (warmupAutoDismissRef.current) clearTimeout(warmupAutoDismissRef.current);
    warmupAutoDismissRef.current = setTimeout(() => {
      dismissWarmup();
    }, 11 * 60 * 1000);
  };

  // Auto-collapse warmup when all items checked
  useEffect(() => {
    if (phase !== 'workout' || warmupCollapsed) return;
    const warmup = getWarmupRoutine('full');
    const totalItems = warmup.cardio.length + warmup.mobility.length;
    const checkedCount = Object.values(warmupChecked).filter(Boolean).length;
    if (totalItems > 0 && checkedCount >= totalItems) {
      const timer = setTimeout(() => {
        dismissWarmup();
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
  }, [warmupChecked, warmupCollapsed, phase]);

  // --- Notification helpers ---
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  };

  const restMotivationMessages = [
    { title: "Let's go!", body: "Rest's over \u2014 crush this next set!" },
    { title: 'Time to work!', body: 'Your muscles are ready. Show them what you\'ve got.' },
    { title: 'You got this!', body: 'That rest was earned. Now get back after it!' },
    { title: 'Back at it!', body: 'Recovery complete \u2014 time to make it count.' },
    { title: 'Go time!', body: 'You\'re warmed up and locked in. Send it!' },
    { title: 'No stopping you!', body: 'One set closer to your goals. Let\'s move!' },
  ];

  const scheduleRestNotification = async (seconds: number) => {
    try {
      await requestNotificationPermissions();
      const msg = restMotivationMessages[Math.floor(Math.random() * restMotivationMessages.length)];
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
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

  const [previousNotes, setPreviousNotes] = useState<Record<string, string>>({});
  const [noteModalIdx, setNoteModalIdx] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');

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
      const notesMap: Record<string, string> = {};
      for (const log of logs) {
        const exs = log.exercises as LoggedExercise[];
        for (const ex of exs) {
          if (!prevMap[ex.name]) prevMap[ex.name] = ex.sets;
          if (ex.attachment) {
            const key = `${ex.name}|${ex.attachment}`;
            if (!prevMap[key]) prevMap[key] = ex.sets;
          }
          // Store previous notes by exercise name
          if (ex.notes && !notesMap[ex.name]) notesMap[ex.name] = ex.notes;
        }
      }
      setPreviousSets(prevMap);
      setPreviousNotes(notesMap);
    } catch {}
  };

  const getSuggestedWeight = (exerciseName: string, attachment?: string | null): number | null => {
    if (isBodyweightExercise(exerciseName)) return null;
    const key = attachment ? `${exerciseName}|${attachment}` : exerciseName;
    const prev = previousSets[key] || previousSets[exerciseName];
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

  // Start rest timer (epoch-based — survives app backgrounding)
  const startRestTimer = (manual = false) => {
    if (!manual && !restTimerEnabled) return;
    // Don't restart the timer if it's already running (unless manually triggered)
    if (!manual && restIntervalRef.current) return;
    // Cancel any existing timer interval to prevent duplicates
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;
    // Cancel existing notification synchronously (grab ID before clearing)
    const oldNotifId = restNotificationIdRef.current;
    restNotificationIdRef.current = null;
    if (oldNotifId) {
      Notifications.cancelScheduledNotificationAsync(oldNotifId).catch(() => {});
    }

    const epoch = Date.now();
    setRestStartEpoch(epoch);
    setRestRemaining(restTimerDuration);
    scheduleRestNotification(restTimerDuration);
    restIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - epoch) / 1000);
      const remaining = Math.max(0, restTimerDuration - elapsed);
      setRestRemaining(remaining);
      if (remaining <= 0) {
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
        setRestStartEpoch(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (restTimerSound) playRestTimerChime();
        restNotificationIdRef.current = null;
      }
    }, 200);
  };

  const skipRestTimer = () => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;
    setRestRemaining(0);
    setRestStartEpoch(null);
    cancelRestNotification();
  };

  // Recalculate rest timer on app foreground
  const restStartEpochRef = useRef(restStartEpoch);
  restStartEpochRef.current = restStartEpoch;

  // --- Exercise picker logic ---
  const filteredExercises = EXERCISE_DATABASE.filter((e) => {
    if (activeFilters.size > 0 && !activeFilters.has(e.category)) return false;
    if (search.trim() && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleExercise = (name: string) => {
    animateLayout();
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const startQuickWorkout = () => {
    if (selectedNames.length === 0) return;
    const routine = activeRoutineRef.current;
    const routineMap = new Map(routine?.exercises.map(e => [e.name, e]) ?? []);
    const initial: LoggedExercise[] = selectedNames.map((name) => {
      const saved = routineMap.get(name);
      const numSets = saved?.sets ?? 3;
      return {
        name,
        sets: Array.from({ length: numSets }, () => ({ weight: null, reps: 0, completed: false })),
      };
    });
    activeRoutineRef.current = null;
    startWorkout(-1, workoutName.trim() || 'My Workout', 'Custom', initial);
    setLoggedExercises(initial);
    startedRef.current = true;
    setPhase('workout');
    // Start paused
    setTimeout(() => pauseWorkout(), 50);
  };

  // Scroll expanded card to top of visible area
  const scrollToExercise = (exIdx: number) => {
    setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: exIdx, animated: true, viewOffset: 12 });
      } catch {}
    }, 350);
  };

  // --- Workout logic ---
  const updateAttachment = (exIdx: number, attachment: string | null) => {
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = { ...updated[exIdx], attachment };
      return updated;
    });
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
    // Mark this set AND all previous uncompleted sets as completed
    setLoggedExercises((prev) => {
      const updated = [...prev];
      const exercise = { ...updated[exIdx] };
      exercise.sets = exercise.sets.map((s, i) =>
        i <= setIdx && !s.completed ? { ...s, completed: true } : s
      );
      updated[exIdx] = exercise;
      return updated;
    });
    // Prefill next set weight (same weight, no adjustment)
    const nextSet = loggedExercises[exIdx].sets[setIdx + 1];
    if (nextSet && currentSet.weight != null && nextSet.weight == null) {
      updateSet(exIdx, setIdx + 1, { ...nextSet, weight: currentSet.weight });
    }
    // Auto-advance to next exercise when all sets complete
    const updatedSets = loggedExercises[exIdx].sets.map((s, i) =>
      i <= setIdx ? { ...s, completed: true } : s
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
    } else if (currentGroupId && !allDone) {
      // In a superset but alternating logic couldn't find a target — find the partner
      // and advance to them without starting rest timer (rest only after both exercises' sets)
      const partnerIdx = loggedExercises.findIndex((ex, i) =>
        i !== exIdx && ex.supersetGroupId === currentGroupId
      );
      if (partnerIdx !== -1 && loggedExercises[partnerIdx].sets.some(s => !s.completed)) {
        animateLayout();
        setActiveExercise(partnerIdx);
      } else {
        startRestTimer();
      }
    } else {
      startRestTimer();
      // No auto-advance — user clicks NEXT to move to the next exercise
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
    // Skip animateLayout() here — LayoutAnimation dismisses the keyboard
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

  const addExerciseDuringWorkout = (name: string) => {
    animateLayout();
    const newEx: LoggedExercise = { name, sets: Array.from({ length: 3 }, () => ({ weight: null, reps: 0, completed: false })) };
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
    const workoutStartedAt = activeWorkout?.createdAt ? new Date(activeWorkout.createdAt).toISOString() : new Date().toISOString();
    const exercisesSnapshot = JSON.parse(JSON.stringify(loggedExercises));
    const trimmedName = workoutName.trim() || 'My Workout';
    const deltasSnapshot = { ...sessionDeltasRef.current };

    // Navigate immediately — don't wait for DB write
    clearWorkout();
    router.replace({
      pathname: '/workout/post-workout',
      params: {
        exercises: JSON.stringify(exercisesSnapshot),
        dayName: trimmedName,
        focus: 'Custom',
        durationMinutes: String(durationMinutes),
        startedAt: workoutStartedAt,
      },
    });

    // Save to Supabase in the background (fire and forget)
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('workout_logs').insert({
            user_id: user.id,
            plan_id: null,
            day_name: trimmedName,
            exercises: exercisesSnapshot,
            duration_minutes: durationMinutes,
            completed_at: new Date().toISOString(),
          });

          detectAndSavePRs(user.id, exercisesSnapshot);
          updateIncrementsAfterWorkout(deltasSnapshot);

          // Save/update routine template so user can reuse it
          const routineExercises = exercisesSnapshot.map((ex: any) => ({
            name: ex.name,
            sets: ex.sets.length,
            reps: String(Math.max(...ex.sets.map((s: any) => s.reps || 0)) || 10),
          }));
          const { data: existing } = await supabase
            .from('saved_routines')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', trimmedName)
            .limit(1)
            .maybeSingle();
          if (existing) {
            await supabase.from('saved_routines').update({
              exercises: routineExercises,
              last_used_at: new Date().toISOString(),
            }).eq('id', existing.id);
          } else {
            await supabase.from('saved_routines').insert({
              user_id: user.id,
              name: trimmedName,
              exercises: routineExercises,
              last_used_at: new Date().toISOString(),
            });
          }
        }
      } catch {}
    })();
  };

  const handleRestart = () => {
    if (!confirmRestart) {
      setConfirmRestart(true);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => setConfirmRestart(false), 3000);
      return;
    }
    // Second tap - restart
    setConfirmRestart(false);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    const initial: LoggedExercise[] = loggedExercises.map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets.length }, () => ({
        weight: null,
        reps: 0,
        completed: false,
      })),
    }));
    clearWorkout();
    startWorkout(-1, 'Quick', 'Quick Workout', initial);
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
    router.back();
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
          paddingVertical: 10,
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}>
          <Pressable onPress={handleExit} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>Choose Exercises</Text>
          <Pressable
            onPress={() => {
              if (selectedNames.length === 0) return;
              activeRoutineRef.current = null;
              setWorkoutName('My Workout');
              setShowNamePrompt(true);
            }}
            hitSlop={12}
            style={{ padding: 4 }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: selectedNames.length > 0 ? theme.text : theme.textSecondary }}>
              NEXT
            </Text>
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
              placeholder="Search exercises..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
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
        </View>


        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Saved Routines */}
          {savedRoutinesLoaded && savedRoutines.length > 0 && !search && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 8 }}>
                Saved Routines
              </Text>
              {savedRoutines.map((routine) => (
                <Pressable
                  key={routine.id}
                  onPress={() => {
                    // Pre-fill exercises from saved routine
                    const names = routine.exercises.map((e: any) => e.name);
                    setSelectedNames(names);
                    setWorkoutName(routine.name);
                    activeRoutineRef.current = routine;
                    setShowNamePrompt(true);
                  }}
                  onLongPress={() => {
                    Alert.alert('Delete Routine', `Remove "${routine.name}" from saved routines?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        await supabase.from('saved_routines').delete().eq('id', routine.id);
                        setSavedRoutines(prev => prev.filter(r => r.id !== routine.id));
                      }},
                    ]);
                  }}
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1, borderColor: theme.border, borderRadius: 12,
                    paddingHorizontal: 14, paddingVertical: 12,
                    marginBottom: 8, flexDirection: 'row', alignItems: 'center',
                  }}
                >
                  <Ionicons name="bookmark" size={18} color={avatarColor} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{routine.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                      {routine.exercises.length} exercises
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.chrome} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Camera + Custom buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
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
            <Pressable
              onPress={() => setShowCreateCustom(true)}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 12,
                borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.chrome} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.chrome }}>Custom</Text>
            </Pressable>
          </View>

          {scanning && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
              <ActivityIndicator size="small" color={theme.chrome} />
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>Identifying equipment...</Text>
            </View>
          )}

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

        {selectedNames.length > 0 && (
          <View style={{
            paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
            backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
          }}>
            {EXERCISE_CATEGORIES.map((cat) => {
              const catNames = selectedNames.filter((n) => {
                const found = EXERCISE_DATABASE.find((e) => e.name === n);
                const custom = customExercises.find((ce) => ce.name === n);
                if (custom) return custom.muscleGroup === cat;
                return found?.category === cat;
              });
              if (catNames.length === 0) return null;
              return (
                <View key={cat} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>{cat}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {catNames.map((name) => (
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
                </View>
              );
            })}
          </View>
        )}

        {/* Name prompt modal */}
        <Modal visible={showNamePrompt} transparent animationType="fade">
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
            onPress={() => setShowNamePrompt(false)}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 20,
                padding: 24,
                width: '85%',
                maxWidth: 360,
              }}
            >
              <TextInput
                style={{
                  fontSize: 16,
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  marginBottom: 20,
                }}
                placeholder="My Workout"
                placeholderTextColor={theme.textSecondary}
                value={workoutName}
                onChangeText={setWorkoutName}
                maxLength={40}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  setShowNamePrompt(false);
                  startQuickWorkout();
                }}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => setShowNamePrompt(false)}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                    borderWidth: 1, borderColor: theme.border,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowNamePrompt(false);
                    startQuickWorkout();
                  }}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                    backgroundColor: theme.text,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.background }}>Start</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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
              {EXERCISE_CATEGORIES.filter((cat) => cat !== 'Cardio').map((cat) => (
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
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Equipment</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {EQUIPMENT_TYPES.map((eq) => (
                <Pressable
                  key={eq}
                  onPress={() => setCustomEquipment(eq)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: customEquipment === eq ? theme.text : theme.background,
                    borderWidth: 1, borderColor: customEquipment === eq ? theme.text : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: customEquipment === eq ? theme.background : theme.text }}>{eq}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={() => { setShowCreateCustom(false); setCustomName(''); setCustomEquipment('Barbell'); }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!customName.trim()) return;
                await createCustomExercise(customName.trim(), customMuscleGroup, customEquipment);
                addExercise(customName.trim());
                setShowCreateCustom(false);
                setCustomName('');
                setCustomEquipment('Barbell');
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

  const addGroupedByCategory = EXERCISE_CATEGORIES.map((cat) => ({
    category: cat,
    exercises: EXERCISE_DATABASE.filter((e) =>
      e.category === cat &&
      e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
      !loggedExercises.some((le) => le.name.toLowerCase() === e.name.toLowerCase()) &&
      (activeFilters.size === 0 || activeFilters.has(e.category))
    ),
  })).filter((g) => g.exercises.length > 0);

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
      <SetRowKeyboardAccessory />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Floating timer pill + REST button when keyboard is open */}
        {keyboardHeight > 0 && (
          <View style={{
            position: 'absolute',
            bottom: keyboardHeight + 12,
            right: 16,
            zIndex: 999,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            {/* Rest / Clock icon button */}
            <Pressable
              onPress={() => {
                if (isResting) skipRestTimer();
                else startRestTimer(true);
              }}
            >
              <View style={{
                backgroundColor: isResting ? '#EAB308' : 'rgba(0,0,0,0.6)',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isResting ? '#D97706' : 'rgba(255,255,255,0.15)',
              }}>
                {isResting ? (
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#000000', fontVariant: ['tabular-nums'], letterSpacing: 1 }}>
                    {formatTime(restRemaining)}
                  </Text>
                ) : (
                  <Ionicons name="time" size={18} color="#FFFFFFCC" />
                )}
              </View>
            </Pressable>
            {/* Timer pill — pressable to pause/resume */}
            <Pressable onPress={() => { if (isPaused) resumeWorkout(); else pauseWorkout(); }}>
              <View style={{
                backgroundColor: avatarColor,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                {isPaused && <Ionicons name="pause" size={12} color="#FFFFFFAA" />}
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'], letterSpacing: 1 }}>
                  {formatTimeMs(displayMs)}
              </Text>
              </View>
            </Pressable>
          </View>
        )}
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingVertical: 10,
          backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
          <Pressable onPress={handleExit} hitSlop={12} style={{ padding: 4, marginRight: 8 }}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
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
                  {stripParens(workoutName.trim() || 'My Workout')}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={theme.chrome} />
              </Pressable>
            )}
            <View style={{ marginTop: 4 }}>
              <MuscleGroupPills categories={getExerciseCategories(loggedExercises)} size="small" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {reorderMode ? (
              <Pressable
                onPress={() => { setReorderMode(false); animateLayout(); }}
                hitSlop={12}
                style={{ padding: 4 }}
              >
                <Ionicons name="checkmark-circle" size={22} color={SemanticColors.success} />
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
                <Ionicons name="checkmark-circle" size={22} color={SemanticColors.success} />
              </Pressable>
            ) : (
              <>
                {/* Superset link */}
                <Pressable onPress={() => { setSelectionMode(true); animateLayout(); }} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="link-outline" size={18} color={theme.chrome} />
                </Pressable>
                {/* Add exercise */}
                <Pressable onPress={() => setAddExerciseOpen(true)} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="add-outline" size={20} color={theme.chrome} />
                </Pressable>
                {/* Restart - two-tap confirm */}
                <Pressable onPress={handleRestart} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="refresh-outline" size={18} color={confirmRestart ? SemanticColors.danger : theme.chrome} />
                </Pressable>
                {/* Discard - two-tap confirm */}
                <Pressable onPress={handleDiscard} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={confirmDiscard ? SemanticColors.danger : theme.chrome} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <DraggableFlatList
          ref={listRef}
          data={loggedExercises}
          keyExtractor={(item, i) => `${item.name}-${i}`}
          onDragEnd={({ data }) => { setLoggedExercises(data); setActiveExercise(null); animateLayout(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 500 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={() => {}}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => { if (unlinkConfirmIdx !== null) setUnlinkConfirmIdx(null); }}
          ListHeaderComponent={(() => {
            if (!warmupEnabled || workoutStarted) return null;
            const warmup = getWarmupRoutine('full');
            const totalItems = warmup.cardio.length + warmup.mobility.length;
            const checkedCount = Object.values(warmupChecked).filter(Boolean).length;
            const allWarmupDone = totalItems > 0 && checkedCount >= totalItems;
            const anySetCompleted = loggedExercises.some(ex => ex.sets.some(s => s.completed));

            if (warmupCollapsed) {
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
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: theme.text,
                  }}>Warm-Up</Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </Pressable>
              );
            }

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
                    <Pressable onPress={() => { dismissWarmup(); }} hitSlop={8} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>DISMISS</Text>
                    </Pressable>
                    <Pressable onPress={startFromWarmup} disabled={workoutStarted} hitSlop={8} style={{ backgroundColor: workoutStarted ? theme.chrome : theme.text, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
                      <Text style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>{workoutStarted ? 'IN PROGRESS' : 'START'}</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>
                  5 min cardio + dynamic stretching
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
            const isExpanded = reorderMode ? false : activeExercise === exIdx;
            const detailsOpen = expandedDetails[exIdx] ?? false;
            const suggested = getSuggestedWeight(logged.name, logged.attachment);
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
                  <View style={{
                    marginBottom: isInSuperset && !isLastOfSuperset ? 0 : 12,
                    borderRadius: 16,
                    backgroundColor: isExpanded ? theme.surface : 'transparent',
                    borderWidth: isExpanded ? 1 : 0, borderColor: theme.border,
                    paddingTop: isInSuperset && !isFirstOfSuperset ? 4 : 12,
                    paddingBottom: isInSuperset && !isLastOfSuperset ? 4 : 12,
                    paddingHorizontal: 12,
                  }}>
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
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: allSetsComplete ? SemanticColors.success : logged.sets.some((s) => s.completed) ? '#EAB308' : theme.textSecondary,
                        marginRight: 10,
                        minWidth: 16,
                        textAlign: 'center',
                      }}>
                        {exIdx + 1}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, flexShrink: 1 }} numberOfLines={1}>
                          {logged.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2 }}>
                          {logged.sets.length} set{logged.sets.length !== 1 ? 's' : ''}
                        </Text>
                        {suggested != null && (
                          <Text style={{ fontSize: 12, color: theme.chrome, marginTop: 2 }}>
                            Suggested: {suggested} {unitLabel} based on last session
                          </Text>
                        )}
                      </View>
                      {/* Notes icon — only when expanded */}
                      {isExpanded && (
                        <Pressable
                          onPress={() => {
                            setNoteText(logged.notes ?? '');
                            setNoteModalIdx(exIdx);
                          }}
                          hitSlop={8}
                          style={{ padding: 4, marginLeft: 4 }}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={16}
                            color={logged.notes ? '#F59E0B' : theme.chrome}
                          />
                        </Pressable>
                      )}
                      {/* Info icon - hide for custom exercises (no data) */}
                      {!customExercises.some((ce) => ce.name.toLowerCase() === logged.name.toLowerCase()) && (
                        <ExerciseThumbnail exerciseName={logged.name} theme={theme} />
                      )}
                      {/* Delete icon */}
                      {isExpanded && loggedExercises.length > 1 && (
                        <Pressable onPress={() => removeExercise(exIdx)} hitSlop={8} style={{ padding: 4, marginLeft: 4 }}>
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
                          <View style={{ backgroundColor: theme.background, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
                            <Text style={{ fontSize: 14, color: theme.text, lineHeight: 20 }}>{instructions}</Text>
                          </View>
                        )}
                        {/* Cable attachment picker */}
                        {isCableExercise(logged.name, customExercises.find((ce) => ce.name.toLowerCase() === logged.name.toLowerCase())?.equipment) && (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              {getAttachmentsForExercise(logged.name).map((att) => (
                                <Pressable
                                  key={att}
                                  onPress={() => updateAttachment(exIdx, logged.attachment === att ? null : att)}
                                  style={{
                                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                                    backgroundColor: logged.attachment === att ? '#F59E0B' : theme.background,
                                    borderWidth: 1, borderColor: logged.attachment === att ? '#F59E0B' : theme.border,
                                  }}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: logged.attachment === att ? '#000' : theme.textSecondary }}>{att}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </ScrollView>
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
                              equipment={customExercises.find((ce) => ce.name.toLowerCase() === logged.name.toLowerCase())?.equipment}
                              isLastSet={isLast}
                              isSuperset={!!logged.supersetGroupId}
                              isDropSet={set.isDropSet}
                              showLabels={setIdx === 0}
                              adaptiveIncrement={incrementsReady ? getExerciseIncrementSync(logged.name, weightUnit) : undefined}
                              onWeightDelta={(delta) => recordWeightDelta(logged.name, delta)}
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
                          {exIdx + 1 < loggedExercises.length ? (
                            <Pressable
                              onPress={() => {
                                // Auto-complete all sets in current exercise
                                setLoggedExercises((prev) => {
                                  const updated = [...prev];
                                  updated[exIdx] = {
                                    ...updated[exIdx],
                                    sets: updated[exIdx].sets.map((s) => ({ ...s, completed: true })),
                                  };
                                  return updated;
                                });
                                animateLayout();
                                setActiveExercise(exIdx + 1);
                                scrollToExercise(exIdx + 1);
                                // Skip rest timer if advancing to superset partner
                                const currentGroupId = loggedExercises[exIdx]?.supersetGroupId;
                                const nextGroupId = loggedExercises[exIdx + 1]?.supersetGroupId;
                                if (!(currentGroupId && nextGroupId && currentGroupId === nextGroupId)) {
                                  startRestTimer();
                                }
                              }}
                              style={{ width: 44, height: 44, backgroundColor: '#22C55E', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => {
                                // Auto-complete all sets in current (last) exercise
                                setLoggedExercises((prev) => {
                                  const updated = [...prev];
                                  updated[exIdx] = {
                                    ...updated[exIdx],
                                    sets: updated[exIdx].sets.map((s) => ({ ...s, completed: true })),
                                  };
                                  return updated;
                                });
                                animateLayout();
                                setActiveExercise(null); // collapse all — overview mode
                                startRestTimer();
                              }}
                              style={{ paddingHorizontal: 16, height: 44, backgroundColor: '#22C55E', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 }}>FINISH</Text>
                            </Pressable>
                          )}
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

        {/* Bottom bar: [Play/Pause] [Rest] [Clock] [Finish ✓] */}
        <View style={{ backgroundColor: avatarColor, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28 }}>
          <View style={{ position: 'relative', height: 36 }}>
            {/* Clock — absolutely centered */}
            <Pressable
              onPress={() => {
                if (isResting) {
                  skipRestTimer();
                } else if (!workoutStarted && countdown === null) {
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
              disabled={workoutStarted && !isResting}
              style={{ position: 'absolute', top: 0, left: 40, right: 40, alignItems: 'center', justifyContent: 'center', height: 36 }}
            >
              <Text style={{
                fontSize: 22, fontWeight: '700',
                color: isResting ? '#EAB308' : (countdown !== null ? '#FFFFFF99' : (isPaused ? '#FFFFFF99' : '#FFFFFF')),
                fontVariant: ['tabular-nums'], letterSpacing: 1,
              }}>
                {countdown !== null
                  ? String(countdown)
                  : !workoutStarted
                    ? (isResuming.current ? 'RESUME' : 'START')
                    : isResting
                      ? formatTime(restRemaining)
                      : formatTimeMs(displayMs)}
              </Text>
            </Pressable>

            {/* Controls row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36, zIndex: 2 }}>
              {/* Left: Play/Pause */}
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
                  } else if (isPaused) {
                    resumeWorkout();
                  } else {
                    pauseWorkout();
                  }
                }}
                hitSlop={12}
                style={{ padding: 8, width: 40, alignItems: 'center' }}
              >
                <Ionicons
                  name={(!workoutStarted || isPaused) ? 'play' : 'pause'}
                  size={22}
                  color="#FFFFFF"
                />
              </Pressable>

              {/* Rest icon — centered between play/pause and clock */}
              {workoutStarted && (
                <Pressable
                  onPress={() => {
                    if (isResting) skipRestTimer();
                    else startRestTimer(true);
                  }}
                  hitSlop={12}
                  style={{ position: 'absolute', left: 56, top: 0, height: 36, justifyContent: 'center', alignItems: 'center', width: 36, zIndex: 3 }}
                >
                  <Ionicons name="time" size={20} color={isResting ? '#EAB308' : '#FFFFFF'} />
                </Pressable>
              )}

              {/* Right: Finish */}
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
                style={{ padding: 8, width: 40, alignItems: 'center' }}
                disabled={saving}
              >
                <Ionicons
                  name="checkmark"
                  size={22}
                  color={confirmFinish ? SemanticColors.success : '#FFFFFF'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Add exercise modal */}
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
              <Pressable onPress={() => { setAddExerciseOpen(false); setExerciseSearch(''); }} hitSlop={12} style={{ padding: 4, marginRight: 8 }}>
                <Ionicons name="chevron-back" size={24} color={theme.text} />
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
                  placeholder="Search exercises…"
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
                    {EXERCISE_CATEGORIES.filter((cat) => cat !== 'Cardio').map((cat) => (
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
                <Pressable
                  onPress={() => { setAddExerciseOpen(false); setTimeout(() => setShowCreateCustom(true), 350); }}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    paddingVertical: 12,
                    borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed',
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.chrome} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.chrome }}>Custom</Text>
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
              {addGroupedByCategory.map(({ category, exercises: catExercises }) => {
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
                        onPress={() => addExerciseDuringWorkout(ex.name)}
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
              {addGroupedByCategory.length === 0 && (
                <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                  No exercises found
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Exercise Notes Modal */}
        <Modal visible={noteModalIdx !== null} transparent animationType="fade" onRequestClose={() => setNoteModalIdx(null)}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
            onPress={() => setNoteModalIdx(null)}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                padding: 20,
                width: '100%',
                maxWidth: 360,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
                {noteModalIdx !== null ? loggedExercises[noteModalIdx]?.name : ''}
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                Add a note for this exercise
              </Text>
              <TextInput
                style={{
                  backgroundColor: theme.background,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 14,
                  color: theme.text,
                  minHeight: 60,
                  textAlignVertical: 'top',
                }}
                multiline
                placeholder={noteModalIdx !== null ? (previousNotes[loggedExercises[noteModalIdx]?.name] ?? 'e.g. Use rope attachment, go slow on eccentric...') : ''}
                placeholderTextColor={theme.textSecondary}
                value={noteText}
                onChangeText={setNoteText}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                {noteText.length > 0 && (
                  <Pressable
                    onPress={() => {
                      if (noteModalIdx !== null) {
                        setLoggedExercises((prev) => {
                          const copy = [...prev];
                          copy[noteModalIdx] = { ...copy[noteModalIdx], notes: undefined };
                          return copy;
                        });
                      }
                      setNoteText('');
                      setNoteModalIdx(null);
                    }}
                    style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>Clear</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    if (noteModalIdx !== null) {
                      const trimmed = noteText.trim();
                      setLoggedExercises((prev) => {
                        const copy = [...prev];
                        copy[noteModalIdx] = { ...copy[noteModalIdx], notes: trimmed || undefined };
                        return copy;
                      });
                    }
                    setNoteModalIdx(null);
                  }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#F59E0B' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#000' }}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
