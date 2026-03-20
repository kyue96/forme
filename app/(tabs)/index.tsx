import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { useUserStore } from '@/lib/user-store';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { WeeklyCalendar, getWeekDates, dateKey, DAY_NAMES_FULL } from '@/components/WeeklyCalendar';
import { LoggedExercise } from '@/lib/types';
import { formatNumber, animateLayout } from '@/lib/utils';
import { checkAndScheduleNudges } from '@/lib/nudge-service';
import { useHealthKit } from '@/hooks/useHealthKit';
import { EXERCISE_DATABASE } from '@/lib/exercise-data';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';

const MOTIVATIONAL = [
  'Your muscles grow during rest, not during the workout.',
  'Sleep is the most underrated performance enhancer.',
  'Hydrate well. Your body needs it for recovery.',
  'Stretching today prevents injury tomorrow.',
  'Recovery is not optional. It is part of the program.',
];

const RECOVERY_TIPS = [
  'Foam roll your tight spots for 5-10 minutes.',
  'Take a 15-minute walk to promote blood flow.',
  'Try contrast showers: alternate hot and cold water.',
  'Focus on getting 7-9 hours of quality sleep tonight.',
];

const ACTIVITY_TYPES = ['Walk', 'Run', 'Cycle', 'Stretch', 'Other'];

interface Activity {
  id: string;
  type: string;
  duration_minutes: number | null;
  notes: string | null;
}

interface TodaySession {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();
  const { theme, weightUnit } = useSettings();
  const { steps } = useHealthKit();

  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [todayCalories, setTodayCalories] = useState<number | null>(null);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);


  // Activity logging
  const [showActivitySheet, setShowActivitySheet] = useState(false);
  const [activityType, setActivityType] = useState('Walk');
  const [activityDuration, setActivityDuration] = useState('');
  const [activityNotes, setActivityNotes] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);

  // Today's session
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const sessionCardRef = useRef<View>(null);
  const weekLogsRef = useRef<any[]>([]);

  // Meal logging sheet
  const [showMealSheet, setShowMealSheet] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCal, setMealCal] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);


  // Selected day on calendar (null = today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Active workout indicator
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);
  const avatarColor = useUserStore((s) => s.avatarColor);
  const focusCardColor = avatarColor || '#F59E0B';

  // Theme switcher removed - use Settings screen instead

  const weekDates = getWeekDates();
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);
  const todayStr = dateKey(todayMidnight);

  const activeDate = selectedDate ?? todayStr;
  const activeDateObj = selectedDate ? new Date(selectedDate + 'T12:00:00') : now;
  const activeDayName = activeDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const activeWorkoutDay = plan?.weeklyPlan.find((d) => d.dayName.toLowerCase() === activeDayName);

  const jsDayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayIdx = now.getDay();

  const activeIdx = activeDateObj.getDay();
  const nextWorkout = plan?.weeklyPlan.find((d) => {
    const idx = DAY_NAMES_FULL.findIndex((n) => n.toLowerCase() === d.dayName.toLowerCase());
    return idx > activeIdx;
  });

  const planDayNames = new Set(plan?.weeklyPlan.map((d) => d.dayName.toLowerCase()) ?? []);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekStart = dateKey(weekDates[0]);
      const weekEnd = dateKey(weekDates[6]);

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('id, completed_at, day_name, exercises, duration_minutes')
        .eq('user_id', user.id)
        .gte('completed_at', weekStart)
        .lte('completed_at', weekEnd + 'T23:59:59');

      if (logs) {
        weekLogsRef.current = logs;
        const days = new Set(logs.map((l) => l.completed_at?.split('T')[0]).filter(Boolean) as string[]);
        setCompletedDays(days);
        setTodayCompleted(days.has(activeDate));

        // Find active day's completed session for the session card
        const todayLog = logs.find((l) => l.completed_at?.startsWith(activeDate));
        if (todayLog) {
          setTodaySession({
            id: todayLog.id,
            day_name: todayLog.day_name,
            exercises: todayLog.exercises as LoggedExercise[],
            duration_minutes: todayLog.duration_minutes,
          });
        } else {
          setTodaySession(null);
        }
      }

      const { data: meals } = await supabase
        .from('meals')
        .select('calories')
        .eq('user_id', user.id)
        .eq('date', activeDate);

      if (meals && meals.length > 0) {
        setTodayCalories(meals.reduce((s, m) => s + (m.calories ?? 0), 0));
      } else {
        setTodayCalories(null);
      }

      const { data: mealsData } = await supabase
        .from('meals')
        .select('id, name, calories, protein, carbs')
        .eq('user_id', user.id)
        .eq('date', activeDate);
      setTodayMeals(mealsData ?? []);

      // Load selected day's activities
      const { data: activities } = await supabase
        .from('activities')
        .select('id, type, duration_minutes, notes')
        .eq('user_id', user.id)
        .eq('date', activeDate)
        .order('created_at', { ascending: true });
      setTodayActivities((activities as Activity[]) ?? []);

      // Nudges: check inactivity
      checkAndScheduleNudges(user.id);

      // Volume insight: compare this week vs last week
      try {
        const lastWeekMon = new Date(weekDates[0]);
        lastWeekMon.setDate(lastWeekMon.getDate() - 7);
        const lastWeekSun = new Date(weekDates[0]);
        lastWeekSun.setDate(lastWeekSun.getDate() - 1);

        // Check if user has at least 2 full weeks of workout history
        const twoWeeksAgo = new Date(weekDates[0]);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const { data: earliestLog } = await supabase
          .from('workout_logs')
          .select('completed_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: true })
          .limit(1)
          .single();

        const hasEnoughHistory = earliestLog
          ? new Date(earliestLog.completed_at) <= twoWeeksAgo
          : false;

        const { data: thisWeekLogs } = await supabase
          .from('workout_logs')
          .select('exercises')
          .eq('user_id', user.id)
          .gte('completed_at', weekStart)
          .lte('completed_at', weekEnd + 'T23:59:59');

        const { data: lastWeekLogs } = await supabase
          .from('workout_logs')
          .select('exercises')
          .eq('user_id', user.id)
          .gte('completed_at', dateKey(lastWeekMon))
          .lte('completed_at', dateKey(lastWeekSun) + 'T23:59:59');

        const calcVolume = (logsList: any[]) =>
          (logsList ?? []).reduce((total, log) => {
            const exs = log.exercises as LoggedExercise[];
            return total + exs.reduce((s, ex) =>
              s + ex.sets.filter(se => se.completed && se.weight != null).reduce((v, se) => v + (se.weight ?? 0) * se.reps, 0), 0);
          }, 0);

        const thisVol = calcVolume(thisWeekLogs ?? []);
        const lastVol = calcVolume(lastWeekLogs ?? []);
        const thisWeekSessions = (thisWeekLogs ?? []).length;
        // Volume insight removed per user request
      } catch {}
    } catch {}
  }, [activeDate]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Stale session check - prompt user if active workout is older than 24 hours
  const staleCheckDone = useRef(false);
  useEffect(() => {
    if (staleCheckDone.current || !activeWorkout) return;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const createdAt = activeWorkout.createdAt ?? activeWorkout.startTime;
    const age = Date.now() - createdAt;
    if (age > TWENTY_FOUR_HOURS) {
      staleCheckDone.current = true;
      Alert.alert(
        'Stale Workout Found',
        `You have an unfinished "${activeWorkout.dayName}" workout from over 24 hours ago. Would you like to resume or discard it?`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => clearWorkout(),
          },
          {
            text: 'Resume',
            style: 'default',
            onPress: () => {
              if (activeWorkout.dayIndex === -1) {
                router.push('/workout/quick');
              } else {
                router.push(`/workout/${activeWorkout.dayIndex}`);
              }
            },
          },
        ],
      );
    }
  }, [activeWorkout]);



  const handleDayPress = (date: Date, _i: number) => {
    const key = dateKey(date);
    const newActiveDate = key === todayStr ? todayStr : key;
    // Immediately update all state from cached data to prevent flash of stale content
    setTodayCompleted(completedDays.has(newActiveDate));
    const cachedLog = weekLogsRef.current.find((l: any) => l.completed_at?.startsWith(newActiveDate));
    if (cachedLog) {
      setTodaySession({
        id: cachedLog.id,
        day_name: cachedLog.day_name,
        exercises: cachedLog.exercises as LoggedExercise[],
        duration_minutes: cachedLog.duration_minutes,
      });
    } else {
      setTodaySession(null);
    }
    // Don't clear calories/meals/activities — let the re-fetch overwrite them
    // to avoid flashing stale "-" values while loading
    setSelectedDate(key === todayStr ? null : key);
  };

  const saveActivity = async () => {
    setSavingActivity(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('activities').insert({
        user_id: user.id,
        date: activeDate,
        type: activityType,
        duration_minutes: parseInt(activityDuration) || null,
        notes: activityNotes.trim() || null,
      });
      setActivityDuration('');
      setActivityNotes('');
      setShowActivitySheet(false);
      loadData();
    } catch {} finally {
      setSavingActivity(false);
    }
  };

  const saveMeal = async () => {
    setSavingMeal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('meals').insert({
        user_id: user.id,
        date: activeDate,
        name: mealName.trim() || null,
        calories: parseFloat(mealCal) || 0,
        protein: parseFloat(mealProtein) || 0,
        carbs: parseFloat(mealCarbs) || 0,
      });
      setMealName('');
      setMealCal('');
      setMealProtein('');
      setMealCarbs('');
      setShowMealSheet(false);
      loadData();
    } catch {} finally {
      setSavingMeal(false);
    }
  };

  const handleShareSession = async () => {
    if (!todaySession) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to share.');
        return;
      }
      const uri = await captureRef(sessionCardRef, { format: 'png', quality: 1 });
      const asset = await MediaLibrary.createAssetAsync(uri);
      const totalSets = todaySession.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).length, 0);
      await Share.share({
        url: asset.uri,
        message: `Just finished ${todaySession.day_name}: ${todaySession.exercises.length} exercises, ${totalSets} sets in ${todaySession.duration_minutes} min`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
    );
  }

  const quote = MOTIVATIONAL[now.getDate() % MOTIVATIONAL.length];
  const tip = RECOVERY_TIPS[now.getDate() % RECOVERY_TIPS.length];

  // Today's session stats
  const sessionTotalSets = todaySession?.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).length, 0) ?? 0;
  const sessionVolumeRaw = todaySession?.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed && s.weight != null).reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0), 0
  ) ?? 0;
  const sessionVolume = Math.round(sessionVolumeRaw);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar strip */}
        {plan && (
          <WeeklyCalendar
            completedDays={completedDays}
            onDayPress={handleDayPress}
            planDayNames={planDayNames}
            selectedDay={selectedDate}
          />
        )}

        <View style={{ paddingHorizontal: 24 }}>
          {!plan ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
                You don't have a plan yet.{'\n'}Let's build one for you.
              </Text>
              <Pressable
                onPress={() => router.push('/quiz/1')}
                style={{ backgroundColor: theme.text, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 }}
              >
                <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 15 }}>Build my plan</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ marginTop: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  + Create Workout
                </Text>
              </Pressable>
            </View>

          ) : (todayCompleted || todaySession) ? (
            <View style={{ gap: 12, minHeight: 350 }}>
              {/* Workout complete card */}
              <Pressable
                onPress={() => router.push({
                  pathname: '/workout/session-view',
                  params: {
                    exercises: JSON.stringify(todaySession?.exercises ?? []),
                    dayName: todaySession?.day_name ?? '',
                    focus: activeWorkoutDay?.focus ?? todaySession?.day_name ?? '',
                    durationMinutes: String(todaySession?.duration_minutes ?? 0),
                    completedAt: new Date().toISOString(),
                    logId: todaySession?.id ?? '',
                  },
                })}
                style={{ backgroundColor: focusCardColor, borderRadius: 24, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: focusCardColor, marginBottom: 0 }}
              >
                <Text style={{ position: 'absolute', top: 14, right: 16, fontSize: 11, fontWeight: '700', color: '#FFFFFFAA', letterSpacing: 1 }}>VIEW</Text>
                <Ionicons name="checkmark-circle" size={48} color="#FFFFFF" />
                <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 12 }}>
                  Workout Complete
                </Text>
              </Pressable>
              {/* Shareable session card */}
              {todaySession && (
                <Pressable
                  onPress={() => router.push({
                    pathname: '/workout/post-workout',
                    params: {
                      exercises: JSON.stringify(todaySession.exercises),
                      dayName: todaySession.day_name,
                      focus: activeWorkoutDay?.focus ?? todaySession.day_name,
                      durationMinutes: String(todaySession.duration_minutes ?? 0),
                    },
                  })}
                >
                  <View
                    ref={sessionCardRef}
                    collapsable={false}
                    style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}
                  >
                    {/* Header row: workout name + muscle tags */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{activeWorkoutDay?.focus ?? todaySession.day_name}</Text>
                      <MuscleGroupPills categories={getExerciseCategories(todaySession.exercises)} size="small" />
                    </View>
                    {/* Hero volume */}
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 36 }}>
                        {sessionVolume > 0 ? formatNumber(sessionVolume) : '\u2014'}
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
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                          {todaySession.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).reduce((r, set) => r + set.reps, 0), 0)}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>reps</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{todaySession.duration_minutes}m</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>time</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  + Create Workout
                </Text>
              </Pressable>
            </View>

          ) : !activeWorkoutDay ? (
            <View style={{ gap: 12, minHeight: 350 }}>
              {/* Rest Day card — same size/position as Workout Complete card */}
              <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.border, flex: 1, justifyContent: 'center' }}>
                <Ionicons name="moon-outline" size={40} color={theme.chrome} />
                <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 12 }}>Rest Day</Text>
                <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 4 }}>{tip}</Text>
              </View>
              {todaySession && (
                <Pressable
                  onPress={() => router.push({
                    pathname: '/workout/post-workout',
                    params: {
                      exercises: JSON.stringify(todaySession.exercises),
                      dayName: todaySession.day_name,
                      focus: todaySession.day_name,
                      durationMinutes: String(todaySession.duration_minutes ?? 0),
                    },
                  })}
                >
                  <View
                    collapsable={false}
                    style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{todaySession.day_name}</Text>
                      <MuscleGroupPills categories={getExerciseCategories(todaySession.exercises)} size="small" />
                    </View>
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 32, fontWeight: '800', color: theme.text, lineHeight: 36 }}>
                        {sessionVolume > 0 ? formatNumber(sessionVolume) : '\u2014'}
                      </Text>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{weightUnit === 'lbs' ? 'pounds' : 'kg'} moved</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{sessionTotalSets}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>sets</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                          {todaySession.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).reduce((r, set) => r + set.reps, 0), 0)}
                        </Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>reps</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{todaySession.duration_minutes}m</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>time</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              )}
              {nextWorkout && activeDate >= todayStr && (() => {
                const nextDayIdx = DAY_NAMES_FULL.findIndex((n) => n.toLowerCase() === nextWorkout.dayName.toLowerCase());
                const daysUntil = nextDayIdx > activeIdx ? nextDayIdx - activeIdx : nextDayIdx + 7 - activeIdx;
                const nextDate = new Date(activeDateObj);
                nextDate.setDate(activeDateObj.getDate() + daysUntil);
                const dateLabel = nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                return (
                  <View style={{ backgroundColor: focusCardColor, borderRadius: 16, padding: 20 }}>
                    <Text allowFontScaling style={{ fontSize: 10, color: '#FFFFFF99', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                      Up next · {dateLabel}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text allowFontScaling style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
                        {nextWorkout.focus}
                      </Text>
                      <MuscleGroupPills categories={getExerciseCategories(nextWorkout.exercises)} size="normal" />
                    </View>
                    <Text allowFontScaling style={{ fontSize: 12, color: '#FFFFFFCC', marginTop: 4 }}>
                      {nextWorkout.exercises.length} exercises
                    </Text>
                    <View style={{ marginTop: 10, gap: 3 }}>
                      {nextWorkout.exercises.map((ex: any, i: number) => (
                        <Text key={i} allowFontScaling style={{ fontSize: 12, color: '#FFFFFFCC' }}>
                          {`- ${ex.name}`}
                        </Text>
                      ))}
                    </View>
                  </View>
                );
              })()}
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  + Create Workout
                </Text>
              </Pressable>
            </View>

          ) : (
            <View style={{ minHeight: 350 }}>
              {/* Focus card - shows resume state when workout is active */}
              {activeWorkout && !todayCompleted ? (() => {
                const completedSets = activeWorkout.loggedExercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0);
                const totalSets = activeWorkout.loggedExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
                return (
                  <Pressable
                    onPress={() => {
                      if (activeWorkout.dayIndex === -1) {
                        router.push('/workout/quick');
                      } else {
                        router.push(`/workout/${activeWorkout.dayIndex}`);
                      }
                    }}
                    style={{ borderRadius: 24, marginBottom: 12, flex: 1, shadowColor: focusCardColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 12 }}
                  >
                    <View style={{ paddingHorizontal: 20, paddingVertical: 24, flex: 1, backgroundColor: focusCardColor, borderRadius: 24 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                            In Progress
                          </Text>
                          <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', lineHeight: 34 }}>
                            {activeWorkout.dayName}
                          </Text>
                          <Text allowFontScaling style={{ fontSize: 15, color: '#FFFFFFDD', marginTop: 6 }}>
                            {completedSets}/{totalSets} sets
                          </Text>
                        </View>
                        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFFFFF99', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                        </View>
                      </View>
                      {/* Exercise progress */}
                      <View style={{ marginTop: 16, gap: 6 }}>
                        {activeWorkout.loggedExercises.map((ex, i) => {
                          const done = ex.sets.filter((s) => s.completed).length;
                          return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name={done === ex.sets.length ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={done === ex.sets.length ? '#FFFFFF' : '#FFFFFF99'} style={{ marginRight: 8 }} />
                              <Text style={{ fontSize: 14, color: done === ex.sets.length ? '#FFFFFF' : '#FFFFFFCC', fontWeight: done === ex.sets.length ? '600' : '400' }}>
                                {ex.name}
                              </Text>
                              <Text style={{ fontSize: 12, color: '#FFFFFF99', marginLeft: 'auto' }}>{done}/{ex.sets.length}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </Pressable>
                );
              })() : (
                <Pressable
                  onPress={() => {
                    const idx = plan.weeklyPlan.indexOf(activeWorkoutDay);
                    router.push(`/workout/${idx}`);
                  }}
                  style={{ borderRadius: 24, marginBottom: 12, shadowColor: focusCardColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 12 }}
                >
                  <View style={{ paddingHorizontal: 20, paddingVertical: 24, backgroundColor: focusCardColor, borderRadius: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <Text allowFontScaling style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                          {selectedDate ? activeDayName.charAt(0).toUpperCase() + activeDayName.slice(1) + "'s Workout" : "Today's Workout"}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', lineHeight: 34 }}>
                          {activeWorkoutDay.focus.includes('(') ? activeWorkoutDay.focus.split('(')[0].trim() : activeWorkoutDay.focus}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 15, color: '#FFFFFFDD', marginTop: 6 }}>
                          {activeWorkoutDay.exercises.length} exercises
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <MuscleGroupPills categories={getExerciseCategories(activeWorkoutDay.exercises)} size="small" />
                        <Ionicons name="play-circle" size={48} color="#FFFFFFCC" style={{ marginTop: 8 }} />
                      </View>
                    </View>
                    {/* Exercise list preview */}
                    <View style={{ marginTop: 16, gap: 6 }}>
                      {activeWorkoutDay.exercises.map((ex, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, color: '#FFFFFFCC', fontWeight: '400' }}>
                            {i + 1}. {ex.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  + Create Workout
                </Text>
              </Pressable>
            </View>
          )}

          {/* Today's stats + Add meal + Add cardio + Steps (four across) */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => router.push('/(tabs)/meals')}
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border }}
            >
              <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4 }}>Total Cal</Text>
              <Text allowFontScaling numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
                {todayCalories != null ? `${todayCalories}` : '-'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMealSheet(true)}
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="restaurant-outline" size={22} color={theme.chrome} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Add Meal</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowActivitySheet(true)}
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="walk-outline" size={22} color={theme.chrome} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Add Cardio</Text>
            </Pressable>
            <View
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border }}
            >
              <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4 }}>Steps</Text>
              <Text allowFontScaling style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
                {steps != null ? formatNumber(steps) : '-'}
              </Text>
            </View>
          </View>


          {/* Today's activities */}
          {todayActivities.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {todayActivities.map((act) => (
                <View key={act.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>
                    {act.type}{act.duration_minutes ? ` · ${act.duration_minutes} min` : ''}
                    {act.notes ? ` · ${act.notes}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Activity logging bottom sheet */}
      <BottomSheet visible={showActivitySheet} onClose={() => setShowActivitySheet(false)}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 }}>Add Activity</Text>

        {/* Activity type pills */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {ACTIVITY_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setActivityType(type)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activityType === type ? theme.text : theme.chromeLight,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: activityType === type ? theme.background : theme.textSecondary }}>{type}</Text>
            </Pressable>
          ))}
        </View>

        {/* Duration */}
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>Duration (minutes)</Text>
        <TextInput
          style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: theme.text, marginBottom: 12 }}
          keyboardType="decimal-pad"
          placeholder=""
          placeholderTextColor={theme.textSecondary}
          value={activityDuration}
          onChangeText={setActivityDuration}
        />

        {/* Notes */}
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>Notes (optional)</Text>
        <TextInput
          style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: theme.text, marginBottom: 16 }}
          placeholder=""
          placeholderTextColor={theme.textSecondary}
          value={activityNotes}
          onChangeText={setActivityNotes}
        />

        <Pressable
          onPress={saveActivity}
          disabled={savingActivity}
          style={{ backgroundColor: theme.text, paddingVertical: 14, borderRadius: 14, alignItems: 'center', opacity: savingActivity ? 0.6 : 1 }}
        >
          <Text style={{ color: theme.background, fontWeight: '700', fontSize: 15 }}>
            {savingActivity ? 'Saving…' : 'Save Activity'}
          </Text>
        </Pressable>
      </BottomSheet>

      {/* Meal logging bottom sheet */}
      <BottomSheet visible={showMealSheet} onClose={() => setShowMealSheet(false)}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, marginBottom: 16 }}>Add meal</Text>

        <TextInput
          style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.text, marginBottom: 10 }}
          placeholder="Meal name (optional)"
          placeholderTextColor={theme.textSecondary}
          underlineColorAndroid="transparent"
          value={mealName}
          onChangeText={setMealName}
        />

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Calories', val: mealCal, set: setMealCal },
            { label: 'Protein (g)', val: mealProtein, set: setMealProtein },
            { label: 'Carbs (g)', val: mealCarbs, set: setMealCarbs },
          ].map(({ label, val, set }) => (
            <View key={label} style={{ flex: 1 }}>
              <Text allowFontScaling style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
              </Text>
              <TextInput
                style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.text }}
                keyboardType="decimal-pad"
                placeholder=""
                placeholderTextColor={theme.textSecondary}
                underlineColorAndroid="transparent"
                value={val}
                onChangeText={set}
              />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={saveMeal}
            disabled={savingMeal}
            style={{ flex: 1, backgroundColor: theme.text, paddingVertical: 12, borderRadius: 12, alignItems: 'center', opacity: savingMeal ? 0.6 : 1 }}
          >
            <Text allowFontScaling style={{ color: theme.background, fontWeight: '700' }}>
              {savingMeal ? 'Saving\u2026' : 'Save'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setShowMealSheet(false); setMealName(''); setMealCal(''); setMealProtein(''); setMealCarbs(''); }}
            style={{ flex: 1, backgroundColor: theme.chromeLight, paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
          >
            <Text allowFontScaling style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </BottomSheet>


    </SafeAreaView>
  );
}
