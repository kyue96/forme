import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
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

const REMINDERS = [
  'Stay hydrated — drink some water.',
  'Stay focused — you got this.',
  'Think about your goals.',
  'Breathe. Control the movement.',
  'Mind-muscle connection.',
  'Quality reps over ego lifts.',
];

const ALTERNATIVES: Record<string, string[]> = {
  'Barbell Bench Press': ['Dumbbell Bench Press', 'Push-ups'],
  'Dumbbell Bench Press': ['Barbell Bench Press', 'Cable Flyes'],
  'Overhead Press': ['Dumbbell Shoulder Press', 'Arnold Press'],
  'Barbell Squat': ['Goblet Squat', 'Leg Press'],
  'Deadlift': ['Romanian Deadlift', 'Barbell Row'],
  'Pull-ups': ['Lat Pulldown', 'Assisted Pull-ups'],
  'Lat Pulldown': ['Pull-ups', 'Cable Row'],
  'Barbell Row': ['Dumbbell Row', 'Cable Row'],
  'Dumbbell Row': ['Barbell Row', 'T-Bar Row'],
  'Bicep Curl': ['Hammer Curl', 'Cable Curl'],
  'Tricep Pushdown': ['Skull Crushers', 'Overhead Extension'],
  'Leg Press': ['Barbell Squat', 'Hack Squat'],
  'Lunges': ['Bulgarian Split Squat', 'Step-ups'],
  'Lateral Raise': ['Cable Lateral Raise', 'Machine Lateral Raise'],
};

function getAlternatives(name: string): string[] {
  if (ALTERNATIVES[name]) return ALTERNATIVES[name];
  const key = Object.keys(ALTERNATIVES).find((k) =>
    name.toLowerCase().includes(k.toLowerCase())
  );
  return key ? ALTERNATIVES[key] : ['Variation with lighter weight', 'Slow tempo variation'];
}

function getFormTip(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('bench') || lower.includes('press'))
    return 'Keep shoulder blades pinched and feet flat on the floor.';
  if (lower.includes('squat'))
    return 'Push knees out over toes. Keep chest up throughout.';
  if (lower.includes('deadlift'))
    return 'Hinge at hips, keep the bar close to your body.';
  if (lower.includes('curl'))
    return "Don't swing — control the negative for better growth.";
  if (lower.includes('row'))
    return 'Squeeze your shoulder blades together at the top.';
  if (lower.includes('pull'))
    return 'Initiate with your lats, not your biceps.';
  if (lower.includes('lateral'))
    return 'Lead with your elbows, slight bend in arms.';
  if (lower.includes('lunge') || lower.includes('split'))
    return 'Keep your torso upright and front knee tracking over toes.';
  return 'Focus on full range of motion and controlled tempo.';
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

  const day = plan?.weeklyPlan[parseInt(dayIndex ?? '0', 10)];
  const startTime = useRef(Date.now());

  const [previousSets, setPreviousSets] = useState<Record<string, LoggedSet[]>>({});
  const [warmupDone, setWarmupDone] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  const [loggedExercises, setLoggedExercises] = useState<LoggedExercise[]>(
    () =>
      day?.exercises.map((ex) => ({
        name: ex.name,
        sets: Array.from({ length: ex.sets }, () => ({
          weight: null,
          reps: 0,
          completed: false,
        })),
      })) ?? []
  );

  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [restTimer, setRestTimer] = useState<{ seconds: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreviousSets();
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
        const exercises = log.exercises as LoggedExercise[];
        for (const ex of exercises) {
          if (!prevMap[ex.name]) {
            prevMap[ex.name] = ex.sets;
          }
        }
      }
      setPreviousSets(prevMap);
    } catch {
      // No previous data
    }
  };

  const getSuggestedWeight = (exerciseName: string): number | null => {
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

  const reminderMap = useMemo(() => {
    const map: Record<number, string> = {};
    day?.exercises.forEach((_, i) => {
      map[i] = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
    });
    return map;
  }, [day]);

  if (!day) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-zinc-500 text-base text-center">Workout not found.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-zinc-900 font-semibold">← Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const updateSet = (exerciseIdx: number, setIdx: number, data: LoggedSet) => {
    setLoggedExercises((prev) => {
      const updated = [...prev];
      updated[exerciseIdx] = {
        ...updated[exerciseIdx],
        sets: updated[exerciseIdx].sets.map((s, i) => (i === setIdx ? data : s)),
      };
      return updated;
    });
  };

  const completeSet = (exerciseIdx: number, setIdx: number) => {
    updateSet(exerciseIdx, setIdx, {
      ...loggedExercises[exerciseIdx].sets[setIdx],
      completed: true,
    });
    const restSecs = parseRestSeconds(day.exercises[exerciseIdx].rest);
    setRestTimer({ seconds: restSecs });
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
    const durationMinutes = Math.round((Date.now() - startTime.current) / 60000);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && plan) {
        await supabase.from('workout_logs').insert({
          user_id: user.id,
          plan_id: plan.id,
          day_name: day.dayName,
          exercises: loggedExercises,
          duration_minutes: durationMinutes,
        });
      }
    } catch {
      // Fail silently
    } finally {
      setSaving(false);
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
  const completedSets = loggedExercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0
  );

  // Next incomplete exercise for the bottom preview
  const nextExerciseIdx = loggedExercises.findIndex(
    (ex, i) => i !== activeExercise && ex.sets.some((s) => !s.completed)
  );
  const nextExercise = nextExerciseIdx >= 0 ? day.exercises[nextExerciseIdx] : null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 pb-3 border-b border-zinc-100">
        <Pressable onPress={() => router.back()} className="mb-3">
          <Text className="text-zinc-500">← Back</Text>
        </Pressable>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              {day.dayName}
            </Text>
            <Text className="text-xl font-bold text-zinc-900">{day.focus}</Text>
          </View>
          <Text className="text-sm text-zinc-500">
            {completedSets}/{totalSets} sets
          </Text>
        </View>
        <View className="mt-3 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-zinc-900 rounded-full"
            style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Warmup Section */}
        {!warmupDone && (
          <View className="mb-6 bg-amber-50 rounded-2xl p-4">
            <Text className="text-base font-bold text-zinc-900 mb-1">Warmup — 5 min</Text>
            <Text className="text-xs text-zinc-500 mb-3">
              Get your blood flowing before lifting.
            </Text>
            {WARMUP.map((w, i) => (
              <View key={i} className="flex-row items-center mb-2">
                <View className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2.5" />
                <Text className="text-sm text-zinc-700 flex-1">{w.name}</Text>
                <Text className="text-xs text-zinc-400">{w.duration}</Text>
              </View>
            ))}
            <Pressable
              onPress={() => setWarmupDone(true)}
              className="bg-zinc-900 py-3 rounded-xl items-center mt-3"
            >
              <Text className="text-white font-semibold text-sm">Done with warmup</Text>
            </Pressable>
          </View>
        )}

        {/* Exercises */}
        {day.exercises.map((exercise, exIdx) => {
          const logged = loggedExercises[exIdx];
          const isExpanded = activeExercise === exIdx;
          const detailsOpen = expandedDetails[exIdx] ?? false;
          const suggested = getSuggestedWeight(exercise.name);
          const alternatives = getAlternatives(exercise.name);
          const formTip = getFormTip(exercise.name);

          return (
            <View key={exIdx} className="mb-5">
              <Pressable
                onPress={() => setActiveExercise(isExpanded ? null : exIdx)}
                className="flex-row items-center justify-between mb-3"
              >
                <View className="flex-1">
                  <Text className="text-base font-bold text-zinc-900">{exercise.name}</Text>
                  <Text className="text-xs text-zinc-500">
                    {exercise.sets} sets · {exercise.reps} reps · {exercise.rest} rest
                  </Text>
                  {suggested != null && (
                    <Text className="text-xs text-blue-600 mt-0.5">
                      Suggested: {suggested} kg
                    </Text>
                  )}
                </View>
                <Text className="text-zinc-400 ml-2">{isExpanded ? '↑' : '↓'}</Text>
              </Pressable>

              {isExpanded && (
                <>
                  {logged?.sets.map((set, setIdx) => (
                    <SetRow
                      key={setIdx}
                      setNumber={setIdx + 1}
                      data={set}
                      onChange={(d) => updateSet(exIdx, setIdx, d)}
                      onComplete={() => completeSet(exIdx, setIdx)}
                    />
                  ))}

                  {/* Collapsible details */}
                  <Pressable
                    onPress={() =>
                      setExpandedDetails((prev) => ({ ...prev, [exIdx]: !prev[exIdx] }))
                    }
                    className="mt-2 py-2"
                  >
                    <Text className="text-xs font-medium text-zinc-400">
                      {detailsOpen ? 'Hide details ↑' : 'Alternatives & tips ↓'}
                    </Text>
                  </Pressable>

                  {detailsOpen && (
                    <View className="bg-zinc-50 rounded-xl p-3 mb-2">
                      <Text className="text-xs font-semibold text-zinc-500 mb-1">
                        Alternatives
                      </Text>
                      {alternatives.map((alt, i) => (
                        <Text key={i} className="text-sm text-zinc-700 mb-0.5">
                          • {alt}
                        </Text>
                      ))}

                      <Text className="text-xs font-semibold text-zinc-500 mt-2 mb-1">
                        Form tip
                      </Text>
                      <Text className="text-sm text-zinc-700">{formTip}</Text>

                      <View className="mt-3 bg-zinc-100 rounded-lg p-2.5">
                        <Text className="text-xs text-zinc-500 italic">
                          {reminderMap[exIdx]}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          );
        })}

        <View className="h-40" />
      </ScrollView>

      {/* Next exercise preview */}
      {nextExercise && (
        <View className="px-6 py-2 bg-zinc-50 border-t border-zinc-100">
          <Text className="text-xs text-zinc-400 font-medium">Up next</Text>
          <Text className="text-sm font-semibold text-zinc-700">
            {nextExercise.name}{' '}
            <Text className="text-xs text-zinc-400 font-normal">
              · {nextExercise.sets}×{nextExercise.reps}
            </Text>
          </Text>
        </View>
      )}

      {/* Finish button */}
      <View className="px-6 pb-8 pt-3 bg-white border-t border-zinc-100">
        <Pressable
          onPress={handleFinish}
          disabled={saving}
          className="bg-zinc-900 py-4 rounded-2xl items-center"
        >
          <Text className="text-white font-semibold text-base">
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
