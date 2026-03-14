import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { SetRow } from '@/components/SetRow';
import { RestTimer } from '@/components/RestTimer';
import { LoggedExercise, LoggedSet } from '@/lib/types';

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

const FORM_TIPS: Record<string, string[]> = {
  chest: [
    'Pull your elbows toward your back pockets as you press.',
    'Imagine bending the bar into a U-shape to engage your chest.',
    'Push the floor away from you on push-ups, don\'t push yourself up.',
    'Think of hugging a big tree on flyes.',
    'Drive your back into the bench like you\'re leaving an imprint.',
    'Pretend you\'re pushing a car that won\'t start.',
    'Squeeze an imaginary pencil between your shoulder blades.',
    'Lower the weight like you\'re pulling a bowstring back.',
    'Elbows at 45 degrees — not flared like a chicken wing.',
    'At the top, imagine pressing through the ceiling.',
  ],
  back: [
    'Pull your elbows toward your back pockets, not your ears.',
    'Chest to the bar, not chin to the bar.',
    'Imagine you\'re starting a lawnmower on rows.',
    'Squeeze a walnut between your shoulder blades at the top.',
    'Think of your hands as hooks — let your back do the pulling.',
    'Drive elbows behind you like you\'re elbowing someone.',
    'Puff your chest out like a gorilla before each pull.',
    'Imagine pulling the bar apart to activate your lats.',
    'Lead with your chest on rows, not your lower back.',
    'Think of rowing a boat — long, controlled strokes.',
  ],
  legs: [
    'Drive through your heels, not your toes.',
    'Sit back like you\'re aiming for a chair that\'s too far away.',
    'Spread the floor apart with your feet on squats.',
    'Push your knees out like you\'re making room for a beach ball.',
    'Imagine you\'re leg pressing the earth away from you.',
    'Keep your shins as vertical as possible on lunges.',
    'Squeeze a coin between your glutes at the top of hip thrusts.',
    'Think of your legs as pistons — powerful and controlled.',
    'On RDLs, push your hips back like closing a car door with your butt.',
    'Drive your knees over your pinky toes on squats.',
  ],
  shoulders: [
    'Press like you\'re putting a box on a high shelf.',
    'Lead with your elbows, slight bend on laterals.',
    'Imagine pouring two pitchers of water on lateral raises.',
    'Think of punching the ceiling on overhead presses.',
    'Keep your wrists stacked over your elbows.',
    'Shrug at the top of overhead press to fully engage traps.',
    'Think of your arms as crane arms — controlled, not swinging.',
    'Raise to ear height only — no need to go higher on laterals.',
    'Imagine pushing through a tube that keeps your arms on track.',
    'Pinch your shoulder blades before pressing.',
  ],
  arms: [
    'Don\'t swing — pretend your elbows are nailed to your sides.',
    'Squeeze the muscle at the top like wringing a towel.',
    'On tricep pushdowns, imagine pushing a wall down.',
    'Curl like you\'re bringing a spoon to your mouth slowly.',
    'Keep your upper arm completely still — only the forearm moves.',
    'On skull crushers, lower to your forehead, not your nose.',
    'Think of your bicep as a hydraulic piston — smooth and controlled.',
    'Rotate your pinky up at the top of curls for peak contraction.',
    'On dips, lean slightly forward for chest, upright for triceps.',
    'Flex your triceps hard at lockout on every pressing movement.',
  ],
  core: [
    'Brace like someone\'s about to punch your stomach.',
    'Pull your belly button toward your spine.',
    'Breathe out hard on the crunch — like fogging a mirror.',
    'Think of your core as a corset wrapping around your torso.',
    'On planks, squeeze your glutes like you\'re holding a coin.',
    'Imagine zipping up a tight pair of jeans — that\'s how you brace.',
    'Roll up vertebra by vertebra, not all at once.',
    'Keep your ribs down — don\'t let them flare up.',
    'Think of your abs as a spring coiling and uncoiling.',
    'Exhale completely at the hardest point of the movement.',
  ],
};

function getFormTip(name: string): string {
  const lower = name.toLowerCase();
  let group = 'core';
  if (lower.includes('bench') || lower.includes('chest') || lower.includes('fly') || lower.includes('push-up') || lower.includes('pushup')) group = 'chest';
  else if (lower.includes('row') || lower.includes('pull') || lower.includes('lat') || lower.includes('deadlift') || lower.includes('back')) group = 'back';
  else if (lower.includes('squat') || lower.includes('leg') || lower.includes('lunge') || lower.includes('calf') || lower.includes('hamstring') || lower.includes('glute') || lower.includes('hip')) group = 'legs';
  else if (lower.includes('shoulder') || lower.includes('overhead') || lower.includes('lateral') || lower.includes('press') || lower.includes('military')) group = 'shoulders';
  else if (lower.includes('curl') || lower.includes('bicep') || lower.includes('tricep') || lower.includes('skull') || lower.includes('pushdown') || lower.includes('extension') || lower.includes('dip')) group = 'arms';

  const tips = FORM_TIPS[group];
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return tips[hash % tips.length];
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

  // Initialize exercises from store if resuming, otherwise fresh
  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>(() => {
    const aw = activeWorkout;
    if (aw?.dayIndex === dayIdx && (aw?.loggedExercises?.length ?? 0) > 0) {
      return aw.loggedExercises;
    }
    return day?.exercises.map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({
        weight: null,
        reps: 0,
        completed: false,
      })),
    })) ?? [];
  });

  const [previousSets, setPreviousSets] = useState<Record<string, LoggedSet[]>>({});
  const [displayMs, setDisplayMs] = useState(0);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});
  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [restTimer, setRestTimer] = useState<{ seconds: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeGif, setActiveGif] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(false);

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
    const initial: LoggedExercise[] = day.exercises.map((ex) => ({
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

  // Fetch GIF/image from Wger when exercise is expanded
  useEffect(() => {
    if (activeExercise === null || !day) {
      setActiveGif(null);
      setGifLoading(false);
      return;
    }
    fetchGif(day.exercises[activeExercise].name);
  }, [activeExercise]);

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
        const exercises = log.exercises as LoggedExercise[];
        for (const ex of exercises) {
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

  const fetchGif = async (exerciseName: string) => {
    setGifLoading(true);
    setActiveGif(null);
    try {
      // Search Wger for the exercise
      const term = encodeURIComponent(exerciseName);
      const searchRes = await fetch(
        `https://wger.de/api/v2/exercise/search/?term=${term}&language=english&format=json`,
        { headers: { Accept: 'application/json' } }
      );
      const searchData = await searchRes.json();
      const baseId = searchData?.suggestions?.[0]?.data?.id;
      if (!baseId) return;

      // Fetch images for this exercise base
      const imgRes = await fetch(
        `https://wger.de/api/v2/exerciseimage/?format=json&exercise_base=${baseId}`,
        { headers: { Accept: 'application/json' } }
      );
      const imgData = await imgRes.json();
      if (imgData?.results?.length > 0) {
        setActiveGif(imgData.results[0].image);
      }
    } catch {
      // Silently fail — no image shown
    } finally {
      setGifLoading(false);
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
      setRestTimer({ seconds: parseRestSeconds(day.exercises[exIdx].rest) });
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
  const nextExercise = nextExIdx >= 0 ? day.exercises[nextExIdx] : null;
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
        {day.exercises.map((exercise, exIdx) => {
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
                  backgroundColor: allSetsComplete ? theme.chrome : theme.border,
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
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.chrome}
                  style={{ marginLeft: 8 }}
                />
              </Pressable>

              {isExpanded && (
                <>
                  {/* Exercise image from Wger */}
                  {(gifLoading || activeGif) && (
                    <View style={{
                      marginBottom: 12,
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: theme.chromeLight,
                      height: gifLoading ? 72 : 180,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {gifLoading ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                          Loading demo…
                        </Text>
                      ) : activeGif ? (
                        <Image
                          source={{ uri: activeGif }}
                          style={{ width: '100%', height: 180 }}
                          resizeMode="contain"
                        />
                      ) : null}
                    </View>
                  )}

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
                      style={{
                        flex: 1,
                        backgroundColor: theme.chromeLight,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>+ Add set</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => removeSet(exIdx)}
                      style={{
                        flex: 1,
                        backgroundColor: theme.chromeLight,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>− Remove set</Text>
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

      {/* Rest timer overlay */}
      {restTimer && (
        <RestTimer seconds={restTimer.seconds} onDismiss={() => setRestTimer(null)} />
      )}
    </SafeAreaView>
  );
}
