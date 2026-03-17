import { useCallback, useRef, useState } from 'react';
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
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { LoggedExercise } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { checkAndScheduleNudges, checkVolumeInsight } from '@/lib/nudge-service';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekDates(): Date[] {
  const now = new Date();
  const dow = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - dow);
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

const MOTIVATIONAL = [
  'Your muscles grow during rest, not during the workout.',
  'Sleep is the most underrated performance enhancer.',
  'Hydrate well — your body needs it for recovery.',
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
  const { theme } = useSettings();

  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [todayCalories, setTodayCalories] = useState<number | null>(null);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);

  const [selectedDay, setSelectedDay] = useState<{ date: Date; dayIdx: number } | null>(null);
  const [dayLog, setDayLog] = useState<any>(null);
  const [dayLogLoading, setDayLogLoading] = useState(false);

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

  // Meal logging sheet
  const [showMealSheet, setShowMealSheet] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCal, setMealCal] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  const [volumeInsight, setVolumeInsight] = useState<string | null>(null);

  // Active workout indicator
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);

  // Theme switcher removed — use Settings screen instead

  const weekDates = getWeekDates();
  const now = new Date();
  const todayStr = dateKey(now);

  const jsDayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayWorkout = plan?.weeklyPlan.find((d) => d.dayName.toLowerCase() === jsDayName);
  const todayIdx = now.getDay();

  const nextWorkout = plan?.weeklyPlan.find((d) => {
    const idx = DAY_NAMES_FULL.findIndex((n) => n.toLowerCase() === d.dayName.toLowerCase());
    return idx > todayIdx;
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
        const days = new Set(logs.map((l) => l.completed_at?.split('T')[0]).filter(Boolean) as string[]);
        setCompletedDays(days);
        setTodayCompleted(days.has(todayStr));

        // Find today's completed session for the session card
        const todayLog = logs.find((l) => l.completed_at?.startsWith(todayStr));
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
        .eq('date', todayStr);

      if (meals && meals.length > 0) {
        setTodayCalories(meals.reduce((s, m) => s + (m.calories ?? 0), 0));
      } else {
        setTodayCalories(null);
      }

      const { data: mealsData } = await supabase
        .from('meals')
        .select('id, name, calories, protein, carbs')
        .eq('user_id', user.id)
        .eq('date', todayStr);
      setTodayMeals(mealsData ?? []);

      // Load today's activities
      const { data: activities } = await supabase
        .from('activities')
        .select('id, type, duration_minutes, notes')
        .eq('user_id', user.id)
        .eq('date', todayStr)
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
        setVolumeInsight(checkVolumeInsight(thisVol, lastVol));
      } catch {}
    } catch {}
  }, [todayStr]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleDayPress = async (date: Date, i: number) => {
    setSelectedDay({ date, dayIdx: i });
    setDayLog(null);
    const dk = dateKey(date);
    const dayName = DAY_NAMES_FULL[i];
    const plannedDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === dayName.toLowerCase());
    setDayLogLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dk + 'T00:00:00')
        .lte('completed_at', dk + 'T23:59:59')
        .limit(1);
      setDayLog({ log: logs?.[0] ?? null, planned: plannedDay });
    } catch {} finally {
      setDayLogLoading(false);
    }
  };

  const saveActivity = async () => {
    setSavingActivity(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('activities').insert({
        user_id: user.id,
        date: todayStr,
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
        date: todayStr,
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
        message: `Just finished ${todaySession.day_name} — ${todaySession.exercises.length} exercises, ${totalSets} sets in ${todaySession.duration_minutes} min`,
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
  const sessionVolume = todaySession?.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed && s.weight != null).reduce((s, set) => s + (set.weight ?? 0) * set.reps, 0), 0
  ) ?? 0;

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
          <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {weekDates.map((date, i) => {
                const dk = dateKey(date);
                const isToday = dk === todayStr;
                const done = completedDays.has(dk);
                const isWorkDay = planDayNames.has(DAY_NAMES_FULL[i].toLowerCase());
                const isPast = date < now && !isToday;

                const circleSize = isToday ? 40 : 36;
                let circleBg = theme.surface;
                let borderStyle: object = { borderWidth: 1, borderColor: theme.border };
                if (isToday) { circleBg = theme.text; borderStyle = {}; }
                else if (!isWorkDay) { circleBg = theme.surface; borderStyle = {}; }
                else if (isPast) { circleBg = theme.surface; }

                return (
                  <Pressable key={i} style={{ alignItems: 'center' }} onPress={() => handleDayPress(date, i)}>
                    <Text allowFontScaling style={{
                      fontSize: 11,
                      marginBottom: 6,
                      fontWeight: isToday ? '700' : '400',
                      color: isToday ? theme.text : theme.textSecondary,
                    }}>
                      {DAY_LABELS[i]}
                    </Text>
                    <View style={{
                      width: circleSize,
                      height: circleSize,
                      borderRadius: circleSize / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: circleBg,
                      ...borderStyle,
                    }}>
                      <Text allowFontScaling style={{
                        fontSize: isToday ? 14 : 13,
                        fontWeight: isToday ? '800' : '600',
                        color: done ? '#22C55E' : isToday ? theme.background : !isWorkDay ? theme.border : theme.textSecondary,
                      }}>
                        {date.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
                  Create your own workout
                </Text>
              </Pressable>
            </View>

          ) : todayCompleted ? (
            <View>
              <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
                <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                <Text allowFontScaling style={{ fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 12, marginBottom: 4 }}>
                  Workout complete
                </Text>
                <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center' }}>
                  Great work today. Recovery starts now.
                </Text>
                {todaySession && (
                  <Pressable
                    onPress={() => router.push({
                      pathname: '/workout/session-view',
                      params: {
                        exercises: JSON.stringify(todaySession.exercises),
                        dayName: todaySession.day_name,
                        focus: todaySession.day_name,
                        durationMinutes: String(todaySession.duration_minutes ?? 0),
                        completedAt: new Date().toISOString(),
                        logId: todaySession.id,
                      },
                    })}
                    style={{ marginTop: 16, backgroundColor: theme.text, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
                  >
                    <Text allowFontScaling style={{ color: theme.background, fontWeight: '600', fontSize: 13 }}>View Session</Text>
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ marginTop: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Create your own workout
                </Text>
              </Pressable>
            </View>

          ) : !todayWorkout ? (
            <View>
              <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.border }}>
                <Text allowFontScaling style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 }}>Rest day</Text>
                <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 16 }}>{quote}</Text>
                <View style={{ backgroundColor: theme.background, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.border }}>
                  <Text allowFontScaling style={{ fontSize: 10, fontWeight: '700', color: theme.chrome, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Recovery tip
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 13, color: theme.text }}>{tip}</Text>
                </View>
              </View>
              {nextWorkout && (
                <View style={{ backgroundColor: theme.text, borderRadius: 16, padding: 20 }}>
                  <Text allowFontScaling style={{ fontSize: 10, color: theme.background + '66', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    Up next
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 15, fontWeight: '800', color: theme.background }}>
                    {nextWorkout.focus}
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 12, color: theme.background + '80', marginTop: 4 }}>
                    {nextWorkout.dayName} · {nextWorkout.exercises.length} exercises
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ marginTop: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Create your own workout
                </Text>
              </Pressable>
            </View>

          ) : (
            <View>
              <Pressable
                onPress={() => {
                  const idx = plan.weeklyPlan.indexOf(todayWorkout);
                  router.push(`/workout/${idx}`);
                }}
                style={{ backgroundColor: theme.text, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling style={{ fontSize: 10, fontWeight: '600', color: theme.background + '66', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                    Focus
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 24, fontWeight: '800', color: theme.background, lineHeight: 30 }}>
                    {todayWorkout.focus}
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 13, color: theme.background + '66', marginTop: 6 }}>
                    {todayWorkout.exercises.length} exercises
                  </Text>
                </View>
                <Ionicons name="play-circle" size={44} color={theme.background + 'CC'} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginBottom: 16 }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Create your own workout
                </Text>
              </Pressable>
            </View>
          )}

          {/* In-progress workout banner */}
          {activeWorkout && !todayCompleted && (() => {
            const completedSets = activeWorkout.loggedExercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0);
            const totalSets = activeWorkout.loggedExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
            return (
              <View
                style={{
                  backgroundColor: '#EAB308',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (activeWorkout.dayIndex === -1) {
                      router.push('/workout/quick');
                    } else {
                      router.push(`/workout/${activeWorkout.dayIndex}`);
                    }
                  }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <Ionicons name="fitness" size={24} color="#000" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>Resume workout</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 2 }}>
                      {activeWorkout.dayName} · {completedSets}/{totalSets} sets
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#000" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    Alert.alert('Discard workout?', 'Your progress will be lost.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Discard', style: 'destructive', onPress: () => clearWorkout() },
                    ]);
                  }}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close-circle-outline" size={22} color="rgba(0,0,0,0.5)" />
                </Pressable>
              </View>
            );
          })()}

          {/* Today's Session card (post-workout share) */}
          {todaySession && (
            <View style={{ marginTop: 8, marginBottom: 16 }}>
              <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Today's Session</Text>
              <View
                ref={sessionCardRef}
                collapsable={false}
                style={{ backgroundColor: theme.text, borderRadius: 16, padding: 12 }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.background, letterSpacing: 2, marginBottom: 8 }}>FORME</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.background }}>{todaySession.day_name}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.background }}>{sessionTotalSets}</Text>
                    <Text style={{ fontSize: 9, color: theme.background + '60' }}>SETS</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.background }}>{sessionVolume > 0 ? formatNumber(Math.round(sessionVolume)) : '\u2014'}</Text>
                    <Text style={{ fontSize: 9, color: theme.background + '60' }}>VOLUME</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.background }}>{todaySession.duration_minutes}</Text>
                    <Text style={{ fontSize: 9, color: theme.background + '60' }}>MIN</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Quick actions: activity (after completed workout) */}
          {plan && todayCompleted && (
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <Pressable
                onPress={() => setShowActivitySheet(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.border }}
              >
                <Ionicons name="walk-outline" size={20} color={theme.chrome} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>Add Activity</Text>
              </Pressable>
            </View>
          )}

          {/* Today's meals + Add meal (side by side) */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => router.push('/(tabs)/meals')}
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border }}
            >
              <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4 }}>Today's meals</Text>
              <Text allowFontScaling style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>
                {todayCalories != null ? `${todayCalories} cal` : '—'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMealSheet(true)}
              style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="restaurant-outline" size={22} color={theme.chrome} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Add meal</Text>
            </Pressable>
          </View>

          {/* Volume insight */}
          {volumeInsight && (
            <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="trending-up" size={18} color={theme.chrome} />
              <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>{volumeInsight}</Text>
            </View>
          )}

          {/* Today's activities */}
          {todayActivities.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {todayActivities.map((act) => (
                <View key={act.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>
                    {act.type}{act.duration_minutes ? ` · ${act.duration_minutes} min` : ''}
                    {act.notes ? ` — ${act.notes}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Day detail modal */}
      <BottomSheet visible={!!selectedDay} onClose={() => setSelectedDay(null)}>
        {dayLogLoading ? (
          <ActivityIndicator color={theme.chrome} />
        ) : selectedDay && (
          <>
            <Text style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
              {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            {dayLog?.log ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                  <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{dayLog.log.day_name}</Text>
                </View>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 16 }}>
                  {dayLog.log.exercises?.length ?? 0} exercises · {dayLog.log.duration_minutes} min
                </Text>
                <Pressable
                  onPress={() => {
                    setSelectedDay(null);
                    router.push(`/(tabs)/workout?logId=${dayLog.log.id}`);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: theme.text,
                    paddingVertical: 14,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: theme.background, fontWeight: '700', fontSize: 14 }}>See Details</Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.background} />
                </Pressable>
              </View>
            ) : dayLog?.planned ? (
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 4 }}>{dayLog.planned.focus}</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>{dayLog.planned.exercises.length} exercises planned</Text>
                {dateKey(selectedDay.date) === todayStr && (
                  <Pressable
                    onPress={() => {
                      setSelectedDay(null);
                      const idx = plan?.weeklyPlan.indexOf(dayLog.planned);
                      if (idx != null && idx >= 0) router.push(`/workout/${idx}`);
                    }}
                    style={{ backgroundColor: theme.text, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 }}
                  >
                    <Text style={{ color: theme.background, fontWeight: '700' }}>Start workout →</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>No workout logged or planned for this day.</Text>
            )}
          </>
        )}
      </BottomSheet>

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
