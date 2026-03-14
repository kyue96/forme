import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Image,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { SetRow } from '@/components/SetRow';
import { RestTimer } from '@/components/RestTimer';
import { LoggedExercise, LoggedSet } from '@/lib/types';
import { SemanticColors } from '@/constants/theme';

function parseRestSeconds(rest: string): number {
  const match = rest.match(/(\d+)/);
  if (!match) return 60;
  const val = parseInt(match[1], 10);
  if (rest.toLowerCase().includes('min')) return val * 60;
  return val;
}

const BODYWEIGHT_KEYWORDS = [
  'push-up', 'push up', 'pushup', 'pull-up', 'pull up', 'pullup',
  'plank', 'burpee', 'jumping jack', 'bodyweight', 'dip', 'crunch',
  'sit-up', 'situp', 'mountain climber',
];

function isBodyweightExercise(name: string): boolean {
  const lower = name.toLowerCase();
  return BODYWEIGHT_KEYWORDS.some((kw) => lower.includes(kw));
}

const EXERCISE_FORM_TIPS: Record<string, string> = {
  // Chest
  'barbell bench press': 'Arch your back slightly, pull shoulder blades together, and drive through the bar with your chest — not your triceps.',
  'dumbbell bench press': 'Let the dumbbells touch at the top, lower with elbows at 45°, and feel the stretch at the bottom.',
  'incline bench press': 'Set the bench to 30-45°. Keep your wrists straight and press toward the ceiling, not your face.',
  'dumbbell incline press': 'Retract your shoulder blades before pressing. Think of pushing the dumbbells together at the top.',
  'chest fly': 'Keep a slight bend in the elbows throughout — imagine hugging a large barrel. Never fully straighten the arms.',
  'push-up': 'Keep your core braced and hips level. Lower until your chest almost touches the floor, then drive back up.',
  // Back
  'pull-up': 'Start from a dead hang. Drive your elbows toward your hips — not behind you. Pull chest to bar.',
  'lat pulldown': 'Lean back slightly, pull the bar to your upper chest. Squeeze shoulder blades at the bottom.',
  'barbell row': 'Hinge at the hips to 45°, keep back flat. Pull the bar to your lower sternum, lead with elbows.',
  'dumbbell row': 'Brace your core on the bench. Pull the dumbbell to your hip, not your shoulder. Full range of motion.',
  'seated cable row': 'Sit tall, pull the handle to your navel. Squeeze shoulder blades at the end of each rep.',
  'deadlift': 'Bar stays over mid-foot. Push the floor away, keep chest tall, lock hips out at the top.',
  'romanian deadlift': 'Push hips back, keep bar close to legs. Feel the hamstring stretch — stop before your back rounds.',
  // Shoulders
  'overhead press': 'Press straight up, lock out overhead. Keep core tight and avoid excessive lower back arch.',
  'military press': 'Grip slightly wider than shoulder-width. Bar clears chin on the way up, finish with arms fully locked.',
  'dumbbell shoulder press': 'Start at ear height, press overhead without flaring ribs. Avoid shrugging at the top.',
  'lateral raise': 'Lead with your elbows, slight bend in arms. Pour pitchers of water to the side — stop at shoulder height.',
  'front raise': 'Controlled tempo, raise to shoulder height only. Avoid swinging — use the shoulder, not momentum.',
  'face pull': 'Pull to your face with hands beside your ears. External rotate at the end to work rear delts.',
  // Arms
  'barbell curl': 'Keep elbows pinned to your sides. Squeeze at the top, lower slowly for 2-3 seconds.',
  'dumbbell curl': 'Rotate your wrist as you curl (supinate). Pause and squeeze at the top of each rep.',
  'hammer curl': 'Neutral grip throughout. Keep upper arm still — only the forearm moves.',
  'tricep pushdown': 'Lock elbows at your sides. Push all the way down and squeeze triceps hard at lockout.',
  'skull crusher': 'Lower the bar to your forehead with elbows pointing up. Press back up in a slight arc.',
  'tricep dip': 'Lean slightly forward for more chest; stay upright for triceps. Lock out fully at the top.',
  'close grip bench press': 'Hands shoulder-width apart. Tuck elbows to your sides and feel your triceps working.',
  // Legs
  'squat': 'Spread the floor apart with your feet. Break at hips and knees simultaneously, depth to at least parallel.',
  'barbell squat': 'Bar on upper traps, chest tall. Sit back and down, drive knees out, explode through heels.',
  'leg press': 'Feet hip-width, push through heels. Never lock out knees fully — keep slight tension throughout.',
  'lunge': 'Step far enough that front shin stays vertical. Back knee hovers just above the floor.',
  'leg extension': 'Pause briefly at full extension. Focus on the quad contraction — don\'t just swing the weight.',
  'leg curl': 'Curl heel to glute, control the descent. Keep hips pressed into the pad throughout.',
  'hip thrust': 'Upper back on bench, drive hips to ceiling. Squeeze glutes hard at the top, hold 1 second.',
  'calf raise': 'Full range of motion — all the way up on toes, all the way down past neutral. Pause at top.',
  // Core
  'plank': 'Squeeze glutes and abs, breathe normally. Don\'t let hips sag or pike up — one rigid line.',
  'crunch': 'Curl up vertebra by vertebra. Focus on shortening the distance between ribs and hips.',
  'sit-up': 'Feet flat, hands at temples. Engage abs to lift, not your neck. Controlled descent.',
  'russian twist': 'Lean back 45°, feet lifted. Rotate side to side, touch the floor with both hands each rep.',
  'hanging leg raise': 'Posterior pelvic tilt before raising legs. Control the descent — resist the swing.',
  'cable crunch': 'Crunch with your abs, not your hips. Keep hips still and pull elbows toward knees.',
};

function getFormTip(name: string): string {
  const lower = name.toLowerCase();
  // Try exact match first
  if (EXERCISE_FORM_TIPS[lower]) return EXERCISE_FORM_TIPS[lower];
  // Try partial match
  for (const [key, tip] of Object.entries(EXERCISE_FORM_TIPS)) {
    if (lower.includes(key) || key.includes(lower)) return tip;
  }
  // Generic fallback by body part keyword
  if (lower.includes('bench') || lower.includes('chest') || lower.includes('fly') || lower.includes('push'))
    return 'Retract shoulder blades before pressing. Feel the muscle stretch at the bottom and squeeze at the top.';
  if (lower.includes('row') || lower.includes('pull') || lower.includes('lat') || lower.includes('back'))
    return 'Think of your hands as hooks. Pull with your elbows, not your biceps. Squeeze shoulder blades together.';
  if (lower.includes('squat') || lower.includes('leg') || lower.includes('lunge'))
    return 'Drive through your heels, keep your chest tall, and push your knees out in line with your toes.';
  if (lower.includes('shoulder') || lower.includes('press') || lower.includes('raise'))
    return 'Keep wrists stacked over elbows. Controlled tempo — 2 seconds up, 2 seconds down.';
  if (lower.includes('curl') || lower.includes('bicep') || lower.includes('tricep'))
    return 'Pin your elbows to your sides. Squeeze hard at peak contraction and lower slowly.';
  return 'Brace your core throughout the movement. Focus on full range of motion and controlled tempo.';
}

const WARMUP = [
  { name: 'Jumping Jacks', duration: '60 sec' },
  { name: 'Arm Circles', duration: '30 sec each direction' },
  { name: 'Leg Swings', duration: '15 each leg' },
  { name: 'Cat-Cow Stretch', duration: '30 sec' },
  { name: 'Bodyweight Squats', duration: '15 reps' },
];

export default function WorkoutScreen() {
  const { dayIndex } = useLocalSearchParams<{ dayIndex: string }>();
  const router = useRouter();
  const { plan } = usePlan();
  const { weightUnit, restTimerEnabled, theme } = useSettings();

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

  // Filter out warmup exercises — handled by the dedicated warmup section
  const exercises = day?.exercises.filter(
    (ex) => !ex.name.toLowerCase().startsWith('warm-up') && !ex.name.toLowerCase().startsWith('warmup') && !ex.name.toLowerCase().includes('warm up')
  ) ?? [];

  // Initialize exercises from store if resuming, otherwise fresh
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
  const [restTimer, setRestTimer] = useState<{ seconds: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [gifState, setGifState] = useState<Record<number, { loading: boolean; url: string | null }>>({});
  const [gifModalIdx, setGifModalIdx] = useState<number | null>(null);

  const startedRef = useRef(false);

  const warmupDone = activeWorkout?.warmupDone ?? false;
  const isPaused = activeWorkout?.isPaused ?? false;

  // Timer tick every second
  useEffect(() => {
    const id = setInterval(() => setDisplayMs(getElapsedMs()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load previous sets for weight suggestions
  useEffect(() => { loadPreviousSets(); }, []);

  // Start workout in store if not already started for this day
  useEffect(() => {
    if (!day || startedRef.current) return;
    startedRef.current = true;
    if (activeWorkout?.dayIndex === dayIdx) return; // Already in store
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
  }, [day]);

  // Sync exercise changes to store immediately
  useEffect(() => {
    if (loggedExercises.length > 0) {
      updateExercises(loggedExercises);
    }
  }, [loggedExercises]);

  // Auto-pause timer on navigate away
  const activeWorkoutRef = useRef(activeWorkout);
  useEffect(() => { activeWorkoutRef.current = activeWorkout; }, [activeWorkout]);

  useFocusEffect(useCallback(() => {
    // Screen gained focus — resume if auto-paused
    const aw = activeWorkoutRef.current;
    if (aw?.isPaused) resumeWorkout();
    return () => {
      // Screen lost focus — auto-pause
      const aw = activeWorkoutRef.current;
      if (aw && !aw.isPaused) pauseWorkout();
    };
  }, []));

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

  const fetchGif = async (exerciseName: string, exIdx: number) => {
    setGifState(prev => ({ ...prev, [exIdx]: { loading: true, url: null } }));
    setGifModalIdx(exIdx);
    try {
      const query = encodeURIComponent(exerciseName);
      const res = await fetch(`https://wger.de/api/v2/exercise/?format=json&language=2&name=${query}&limit=5`);
      const data = await res.json();
      const baseId = data?.results?.[0]?.exercise_base;
      if (!baseId) { setGifState(prev => ({ ...prev, [exIdx]: { loading: false, url: null } })); return; }
      const imgRes = await fetch(`https://wger.de/api/v2/exerciseimage/?format=json&exercise_base=${baseId}`);
      const imgData = await imgRes.json();
      const url = imgData?.results?.[0]?.image ?? null;
      setGifState(prev => ({ ...prev, [exIdx]: { loading: false, url } }));
    } catch {
      setGifState(prev => ({ ...prev, [exIdx]: { loading: false, url: null } }));
    }
  };

  const formatTime = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const handleExit = () => {
    Alert.alert(
      'Exit workout?',
      'Your progress is saved — resume anytime from your plan.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  if (!day) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center' }}>Workout not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>← Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

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
    updateSet(exIdx, setIdx, { ...loggedExercises[exIdx].sets[setIdx], completed: true });
    if (restTimerEnabled) {
      setRestTimer({ seconds: parseRestSeconds(exercises[exIdx].rest) });
    }
  };

  const addSet = (exIdx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: [...updated[exIdx].sets, { weight: null, reps: 0, completed: false }],
      };
      return updated;
    });
  };

  const removeSet = (exIdx: number) => {
    if (loggedExercises[exIdx].sets.length <= 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: updated[exIdx].sets.slice(0, -1),
      };
      return updated;
    });
  };

  const handleFinish = async () => {
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

  const totalSets = loggedExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedSets = loggedExercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const nextExIdx = loggedExercises.findIndex((ex, i) => i !== activeExercise && ex.sets.some((s) => !s.completed));
  const nextExercise = nextExIdx >= 0 ? exercises[nextExIdx] : null;
  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Timer bar */}
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
          <Ionicons name="close-outline" size={26} color={theme.chrome} />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text style={{
            fontSize: 22,
            fontWeight: '700',
            color: isPaused ? theme.chrome : theme.text,
            fontVariant: ['tabular-nums'],
            letterSpacing: 1,
          }}>
            {formatTime(displayMs)}
          </Text>
          <Text style={{
            fontSize: 10,
            color: theme.textSecondary,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            {isPaused ? 'Paused' : day.focus}
          </Text>
        </View>

        <Pressable
          onPress={isPaused ? resumeWorkout : pauseWorkout}
          hitSlop={12}
          style={{ padding: 4 }}
        >
          <Ionicons
            name={isPaused ? 'play-outline' : 'pause-outline'}
            size={24}
            color={theme.chrome}
          />
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        gap: 6,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
            {day.dayName}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary }}>
            {completedSets}/{totalSets} sets
          </Text>
        </View>
        <View style={{ height: 3, backgroundColor: theme.surface, borderRadius: 2, overflow: 'hidden' }}>
          <View style={{
            height: '100%',
            backgroundColor: theme.chrome,
            borderRadius: 2,
            width: `${progressPct}%`,
          }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Warmup — shown once only; persisted in store so it won't reappear on tab switch */}
        {!warmupDone && (
          <View style={{
            marginBottom: 20,
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
              Warmup — 5 min
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
              Get your blood flowing before lifting.
            </Text>
            {WARMUP.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.chrome, marginRight: 10 }} />
                <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>{w.name}</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>{w.duration}</Text>
              </View>
            ))}
            <Pressable
              onPress={() => storeSetWarmupDone(true)}
              style={{
                backgroundColor: theme.text,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              <Text style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>
                Done with warmup
              </Text>
            </Pressable>
          </View>
        )}

        {/* Exercises */}
        {exercises.map((exercise, exIdx) => {
          const logged = loggedExercises[exIdx];
          const isExpanded = activeExercise === exIdx;
          const detailsOpen = expandedDetails[exIdx] ?? false;
          const suggested = getSuggestedWeight(exercise.name);
          const formTip = getFormTip(exercise.name);
          const isBW = isBodyweightExercise(exercise.name);
          const allSetsComplete = logged?.sets.every((s) => s.completed) ?? false;

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
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setActiveExercise(isExpanded ? null : exIdx);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isExpanded ? 12 : 0 }}
              >
                {/* Completion indicator */}
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: allSetsComplete ? SemanticColors.success : SemanticColors.warning,
                  marginRight: 10,
                  flexShrink: 0,
                }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                    {exercise.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    {exercise.sets} sets · {exercise.reps} reps · {exercise.rest} rest
                  </Text>
                  {suggested != null && (
                    <Text style={{ fontSize: 11, color: theme.chrome, marginTop: 2 }}>
                      Suggested: {suggested} {unitLabel} based on last session
                    </Text>
                  )}
                </View>
                {/* Help button */}
                <Pressable
                  onPress={() => fetchGif(exercise.name, exIdx)}
                  style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary }}>?</Text>
                </Pressable>
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
                    <SetRow
                      key={setIdx}
                      setNumber={setIdx + 1}
                      data={set}
                      onChange={(d) => updateSet(exIdx, setIdx, d)}
                      onComplete={() => completeSet(exIdx, setIdx)}
                      isBodyweight={isBW}
                      weightLabel={`Weight (${unitLabel})`}
                    />
                  ))}

                  {/* Add / Remove set */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 }}>
                    <Pressable
                      onPress={() => addSet(exIdx)}
                      style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>+ Add set</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => removeSet(exIdx)}
                      style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 12, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>− Remove set</Text>
                    </Pressable>
                  </View>

                  {/* Form tip toggle */}
                  <Pressable
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedDetails((prev) => ({ ...prev, [exIdx]: !prev[exIdx] }));
                    }}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary }}>
                      {detailsOpen ? 'Hide form tip ↑' : 'Form tip ↓'}
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
                        fontSize: 10,
                        fontWeight: '700',
                        color: theme.chrome,
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}>
                        Form tip
                      </Text>
                      <Text style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>
                        {formTip}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Up next preview */}
      {nextExercise && (
        <View style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}>
          <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
            Up next
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
            {nextExercise.name}
            <Text style={{ fontWeight: '400', color: theme.textSecondary }}>
              {' '}· {nextExercise.sets}×{nextExercise.reps}
            </Text>
          </Text>
        </View>
      )}

      {/* Finish button */}
      <View style={{
        paddingHorizontal: 20,
        paddingBottom: 32,
        paddingTop: 12,
        backgroundColor: theme.background,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      }}>
        <Pressable
          onPress={handleFinish}
          disabled={saving}
          style={{
            backgroundColor: theme.text,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: theme.background, fontWeight: '600', fontSize: 15 }}>
            {saving ? 'Saving…' : 'Finish workout'}
          </Text>
        </Pressable>
      </View>

      {/* GIF Modal */}
      <Modal visible={gifModalIdx !== null} transparent animationType="fade" onRequestClose={() => setGifModalIdx(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setGifModalIdx(null)}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, marginHorizontal: 24, alignItems: 'center', minWidth: 280 }}>
            {gifModalIdx !== null && gifState[gifModalIdx]?.loading ? (
              <Text style={{ color: theme.textSecondary, padding: 24 }}>Loading…</Text>
            ) : gifModalIdx !== null && gifState[gifModalIdx]?.url ? (
              <Image source={{ uri: gifState[gifModalIdx]!.url! }} style={{ width: 280, height: 200 }} resizeMode="contain" />
            ) : (
              <Text style={{ color: theme.textSecondary, padding: 24 }}>No demo found for this exercise.</Text>
            )}
            {gifModalIdx !== null && (
              <Text style={{ color: theme.chrome, fontSize: 12, marginTop: 8 }}>{exercises[gifModalIdx]?.name}</Text>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Rest timer overlay */}
      {restTimer && (
        <RestTimer seconds={restTimer.seconds} onDismiss={() => setRestTimer(null)} />
      )}
    </SafeAreaView>
  );
}
