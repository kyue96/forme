import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
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
import * as Haptics from 'expo-haptics';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useWorkoutStore } from '@/lib/workout-store';
import { useUserStore } from '@/lib/user-store';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { WeeklyCalendar, getWeekDates, dateKey, DAY_NAMES_FULL } from '@/components/WeeklyCalendar';
import { LoggedExercise } from '@/lib/types';
import { formatNumber, animateLayout, stripParens } from '@/lib/utils';
import { LinearGradient } from 'expo-linear-gradient';
import { checkAndScheduleNudges } from '@/lib/nudge-service';
import { useHealthKit } from '@/hooks/useHealthKit';
import { EXERCISE_DATABASE } from '@/lib/exercise-data';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { getExerciseCategories } from '@/lib/exercise-utils';
import { computeVolumeByMuscle, computeTotalVolume } from '@/lib/workout-metrics';
import NextWorkoutCard from '@/components/NextWorkoutCard';
import FormeCoachCard, { getTodayTip } from '@/components/FormeCoachCard';
import RecoveryMapCard from '@/components/RecoveryMapCard';
import TrophyCaseCard from '@/components/TrophyCaseCard';
import BodyStatsCard from '@/components/BodyStatsCard';
import { useAnimatedCounter } from '@/lib/useAnimatedCounter';
import SparkleOverlay from '@/components/SparkleOverlay';
import { BreathingGradient } from '@/components/BreathingGradient';
import WeeklyVolumeTrend from '@/components/WeeklyVolumeTrend';

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
  calories_burned: number | null;
}

interface TodaySession {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { scannedMeal } = useLocalSearchParams<{ scannedMeal?: string }>();
  const { plan, loading } = usePlan();
  const { theme, weightUnit, trackCalories } = useSettings();
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
  const [activityCalories, setActivityCalories] = useState('');
  const [activityCalNotSure, setActivityCalNotSure] = useState(false);
  const [userWeightKg, setUserWeightKg] = useState<number | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);
  const [todayActivities, setTodayActivities] = useState<Activity[]>([]);

  // Today's session
  const [todaySession, setTodaySession] = useState<TodaySession | null>(null);
  const sessionCardRef = useRef<View>(null);
  const weekLogsRef = useRef<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<{ exercises: LoggedExercise[]; completed_at: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [upNextExpanded, setUpNextExpanded] = useState(false);
  const [sessionPRs, setSessionPRs] = useState<{ exercise_name: string; e1rm: number; weight: number; reps: number; previous_e1rm: number | null }[]>([]);
  // Rest day check-in (for streak continuity)
  const [restDayCheckedIn, setRestDayCheckedIn] = useState(false);

  const handleRestDayCheckIn = async () => {
    if (!userId || restDayCheckedIn) return;
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      await supabase.from('activities').insert({
        user_id: userId,
        date: todayDate,
        type: 'rest_check_in',
        duration_minutes: 0,
        notes: 'Rest day check-in',
      });
      setRestDayCheckedIn(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  // Handle barcode scan result
  const consumedScan = useRef<string | null>(null);
  useEffect(() => {
    if (scannedMeal && consumedScan.current !== scannedMeal) {
      consumedScan.current = scannedMeal;
      try {
        const data = JSON.parse(scannedMeal);
        setMealName(data.name || '');
        setMealCal(data.calories || '');
        setMealProtein(data.protein || '');
        setMealCarbs(data.carbs || '');
        setShowMealSheet(true);
      } catch {}
    }
  }, [scannedMeal]);

  // Meal logging sheet
  const [showMealSheet, setShowMealSheet] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCal, setMealCal] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);


  // Quick stats

  // Selected day on calendar (null = today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Active workout indicator
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);
  const getElapsedMs = useWorkoutStore((s) => s.getElapsedMs);
  const clearWorkout = useWorkoutStore((s) => s.clearWorkout);
  const avatarColor = useUserStore((s) => s.avatarColor);
  const storeUserId = useUserStore((s) => s.userId);
  const focusCardColor = avatarColor || '#F59E0B';

  // Create gradient colors: lighter tint → base → darker shade
  const lighten = (hex: string, amount: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `#${Math.min(255, Math.round(r + (255 - r) * amount)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(g + (255 - g) * amount)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(b + (255 - b) * amount)).toString(16).padStart(2, '0')}`;
  };
  const darken = (hex: string, amount: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `#${Math.max(0, Math.round(r * (1 - amount))).toString(16).padStart(2, '0')}${Math.max(0, Math.round(g * (1 - amount))).toString(16).padStart(2, '0')}${Math.max(0, Math.round(b * (1 - amount))).toString(16).padStart(2, '0')}`;
  };
  const gradientColors: [string, string, string] = [darken(focusCardColor, 0.2), focusCardColor, lighten(focusCardColor, 0.25)];

  // FAB state
  const [fabOpen, setFabOpen] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const fabAnim = useRef(new Animated.Value(0)).current;

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
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;
      if (!userId) setUserId(uid);
      const user = { id: uid }; // compat shim for existing references below

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
            completed_at: todayLog.completed_at,
          });
          // Fetch PRs achieved in this session's timeframe
          const logDate = todayLog.completed_at?.split('T')[0];
          if (logDate) {
            const { data: prs } = await supabase
              .from('personal_records')
              .select('exercise_name, e1rm, weight, reps, previous_e1rm')
              .eq('user_id', user.id)
              .gte('achieved_at', logDate)
              .lte('achieved_at', logDate + 'T23:59:59');
            // Only show PRs that beat a previous record (not first-time baselines)
            setSessionPRs((prs ?? []).filter(pr => pr.previous_e1rm != null));
          }
        } else {
          setTodaySession(null);
          setSessionPRs([]);
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
        .select('id, type, duration_minutes, notes, calories_burned')
        .eq('user_id', user.id)
        .eq('date', activeDate)
        .order('created_at', { ascending: true });
      setTodayActivities((activities as Activity[]) ?? []);
      // Check if user already checked in for rest day
      setRestDayCheckedIn(((activities as Activity[]) ?? []).some((a: any) => a.type === 'rest_check_in'));

      // Load user weight for calorie estimation
      const { data: profile } = await supabase
        .from('profiles')
        .select('weight')
        .eq('id', user.id)
        .single();
      if (profile?.weight) {
        const w = parseFloat(profile.weight);
        if (!isNaN(w) && w > 0) setUserWeightKg(w);
      }

      // Nudges: check inactivity
      checkAndScheduleNudges(user.id);

      // Recent 7-day logs for training readiness + streak
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: recentData } = await supabase
        .from('workout_logs')
        .select('exercises, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dateKey(sevenDaysAgo))
        .order('completed_at', { ascending: false });
      setRecentLogs((recentData as { exercises: LoggedExercise[]; completed_at: string }[]) ?? []);

      // streak computation removed from homescreen

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



  const toggleFab = () => {
    const toValue = fabOpen ? 0 : 1;
    setFabOpen(!fabOpen);
    Animated.spring(fabAnim, { toValue, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
  };

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
        completed_at: cachedLog.completed_at,
      });
    } else {
      setTodaySession(null);
    }
    // Don't clear calories/meals/activities — let the re-fetch overwrite them
    // to avoid flashing stale "-" values while loading
    setSelectedDate(key === todayStr ? null : key);
  };

  // MET values for calorie estimation
  const MET_VALUES: Record<string, number> = { Walk: 3.5, Run: 8.0, Cycle: 6.0, Stretch: 2.5, Other: 4.0 };

  const getCalorieEstimate = () => {
    if (!userWeightKg || !activityDuration) return null;
    const dur = parseInt(activityDuration);
    if (!dur || dur <= 0) return null;
    const met = MET_VALUES[activityType] ?? 4.0;
    const cal = userWeightKg * met * (dur / 60);
    const low = Math.round(cal * 0.85);
    const high = Math.round(cal * 1.15);
    return { low, high, mid: Math.round(cal) };
  };

  const saveActivity = async () => {
    setSavingActivity(true);
    try {
      const uid = userId || storeUserId;
      if (!uid) return;
      let calBurned: number | null = null;
      if (activityCalNotSure) {
        const est = getCalorieEstimate();
        calBurned = est?.mid ?? null;
      } else if (activityCalories.trim()) {
        calBurned = parseInt(activityCalories) || null;
      }
      await supabase.from('activities').insert({
        user_id: uid,
        date: activeDate,
        type: activityType,
        duration_minutes: parseInt(activityDuration) || null,
        notes: activityNotes.trim() || null,
        calories_burned: calBurned,
      });
      setActivityDuration('');
      setActivityNotes('');
      setActivityCalories('');
      setActivityCalNotSure(false);
      setShowActivitySheet(false);
      loadData();
    } catch {} finally {
      setSavingActivity(false);
    }
  };

  const saveMeal = async () => {
    setSavingMeal(true);
    try {
      const uid = userId || storeUserId;
      if (!uid) return;
      await supabase.from('meals').insert({
        user_id: uid,
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

  // Today's session stats — must compute before hooks below
  const sessionTotalSets = todaySession?.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).length, 0) ?? 0;
  const sessionVolume = todaySession ? computeTotalVolume(todaySession.exercises) : 0;
  const sessionTotalReps = todaySession?.exercises.reduce((s, ex) => s + ex.sets.filter(se => se.completed).reduce((r, set) => r + set.reps, 0), 0) ?? 0;

  // Animated counters — hooks must run before any early return
  const { display: animVolume, done: volumeDone } = useAnimatedCounter(sessionVolume);
  const { display: animSets } = useAnimatedCounter(sessionTotalSets, 1400);
  const { display: animReps } = useAnimatedCounter(sessionTotalReps, 1400);

  if (loading && !plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
    );
  }

  const quote = MOTIVATIONAL[now.getDate() % MOTIVATIONAL.length];
  const tip = RECOVERY_TIPS[now.getDate() % RECOVERY_TIPS.length];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {/* Calendar strip — hidden, infrastructure preserved for potential revert */}
        {/* {plan && (
          <WeeklyCalendar
            completedDays={completedDays}
            onDayPress={handleDayPress}
            planDayNames={planDayNames}
            selectedDay={selectedDate}
            onInteractionStart={() => setScrollEnabled(false)}
            onInteractionEnd={() => setScrollEnabled(true)}
          />
        )} */}

        {/* Date header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textSecondary }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 12 }}>
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
            </View>

          ) : (todayCompleted || todaySession) ? (
            <View style={{ gap: 12 }}>
              {/* Workout Complete banner */}
              <Pressable
                onPress={() => router.push({
                  pathname: '/workout/session-view',
                  params: {
                    exercises: JSON.stringify(todaySession?.exercises ?? []),
                    dayName: todaySession?.day_name ?? '',
                    focus: todaySession?.day_name ?? activeWorkoutDay?.focus ?? '',
                    durationMinutes: String(todaySession?.duration_minutes ?? 0),
                    completedAt: todaySession?.completed_at ?? new Date().toISOString(),
                    logId: todaySession?.id ?? '',
                  },
                })}
                style={{ borderRadius: 16, overflow: 'hidden' }}
              >
                <BreathingGradient color={focusCardColor} style={{ borderRadius: 16, height: 56 }}>
                  <View style={{ paddingHorizontal: 16, height: 56, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                    <Text allowFontScaling style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginLeft: 12, flex: 1 }}>
                      Workout Complete
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFFAA', letterSpacing: 1 }}>VIEW</Text>
                  </View>
                </BreathingGradient>
              </Pressable>

              {todaySession && (
                <>
                  <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border }}>
                  {/* Workout name + muscle pills */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{stripParens(todaySession.day_name || activeWorkoutDay?.focus || 'Workout')}</Text>
                    <MuscleGroupPills categories={getExerciseCategories(todaySession.exercises)} size="small" />
                  </View>

                  {/* Hero volume + stats with sparkle */}
                  <View style={{ position: 'relative' }}>
                    <SparkleOverlay trigger={volumeDone && sessionVolume > 0} color={focusCardColor + '80'} count={16} />

                    {/* Hero volume — animated counter */}
                    <View style={{ alignItems: 'center', marginBottom: 24 }}>
                      <Text style={{ fontSize: 48, fontWeight: '900', color: theme.text, lineHeight: 52 }}>
                        {sessionVolume > 0 ? formatNumber(animVolume) : '\u2014'}
                      </Text>
                      <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>{weightUnit === 'lbs' ? 'pounds' : 'kg'} moved</Text>
                    </View>

                    {/* Stats row — animated counters */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{animSets}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, marginTop: 2 }}>sets</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: theme.border, alignSelf: 'stretch', marginVertical: 4 }} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{animReps}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, marginTop: 2 }}>reps</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: theme.border, alignSelf: 'stretch', marginVertical: 4 }} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>{todaySession.duration_minutes}m</Text>
                        <Text style={{ fontSize: 11, fontWeight: '500', color: theme.textSecondary, marginTop: 2 }}>time</Text>
                      </View>
                    </View>
                  </View>

                  {/* Daily Tip — inline */}
                  <View style={{ borderTopWidth: 1, borderTopColor: theme.border, marginTop: 16, paddingTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Ionicons name="bulb" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 1, marginBottom: 3 }}>FORME TIP</Text>
                      <Text style={{ fontSize: 13, color: theme.text, flex: 1, lineHeight: 18 }}>{getTodayTip()}</Text>
                    </View>
                  </View>
                  </View>

                  {/* PR callout */}
                  {sessionPRs.length > 0 && (
                    <View>
                      {sessionPRs.map((pr) => {
                        // PRs are already in user's display unit — no conversion needed
                        const displayWeight = Math.round(pr.weight);
                        const prevDisplay = pr.previous_e1rm != null ? Math.round(pr.previous_e1rm) : null;
                        const improvement = prevDisplay != null ? displayWeight - prevDisplay : null;
                        return (
                          <View
                            key={pr.exercise_name}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 10,
                              backgroundColor: '#F59E0B18', borderRadius: 12,
                              paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
                              borderWidth: 1, borderColor: '#F59E0B40',
                            }}
                          >
                            <Text style={{ fontSize: 20 }}>🏆</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#F59E0B' }}>New PR</Text>
                              <Text style={{ fontSize: 12, color: theme.text, marginTop: 1 }}>
                                {pr.exercise_name}: {displayWeight} {weightUnit}{improvement != null ? ` (+${improvement})` : ''}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Weekly Volume Trend */}
                  <View>
                    {userId && <WeeklyVolumeTrend userId={userId} accentColor={focusCardColor} onInteractionStart={() => setScrollEnabled(false)} onInteractionEnd={() => setScrollEnabled(true)} />}
                  </View>

                  {/* Recovery Map */}
                  <RecoveryMapCard recentLogs={recentLogs} />

                  {/* Quick Workout + Weigh-In */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => router.push('/workout/quick')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: theme.border }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${focusCardColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="flash" size={20} color={focusCardColor} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Quick Workout</Text>
                    </Pressable>
                    {userId && <BodyStatsCard userId={userId} />}
                  </View>

                  {/* Trophy Case */}
                  {userId && <TrophyCaseCard userId={userId} />}

                  {/* Hidden shareable card for screenshot sharing */}
                  <View
                    ref={sessionCardRef}
                    collapsable={false}
                    style={{ position: 'absolute', left: -9999, top: -9999, backgroundColor: theme.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, width: 340 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{stripParens(activeWorkoutDay?.focus ?? todaySession.day_name)}</Text>
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
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{sessionTotalReps}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>reps</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{todaySession.duration_minutes}m</Text>
                        <Text style={{ fontSize: 10, fontWeight: '500', color: theme.text, opacity: 0.5 }}>time</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>

          ) : !activeWorkoutDay && activeDate < todayStr ? (
            /* Past rest day */
            <View style={{ gap: 12 }}>
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="moon" size={28} color={theme.textSecondary} />
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, marginLeft: 12, flex: 1 }}>Rest Day</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
                  <Ionicons name="bulb" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 1, marginBottom: 3 }}>FORME TIP</Text>
                    <Text style={{ fontSize: 13, color: theme.text, flex: 1, lineHeight: 18 }}>{getTodayTip()}</Text>
                  </View>
                </View>
              </View>
              {userId && <WeeklyVolumeTrend userId={userId} accentColor={focusCardColor} onInteractionStart={() => setScrollEnabled(false)} onInteractionEnd={() => setScrollEnabled(true)} />}
              <RecoveryMapCard recentLogs={recentLogs} />
              {/* Quick Workout + Weigh-In */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => router.push('/workout/quick')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: theme.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${focusCardColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash" size={20} color={focusCardColor} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Quick Workout</Text>
                </Pressable>
                {userId && <BodyStatsCard userId={userId} />}
              </View>
              {userId && <TrophyCaseCard userId={userId} />}
            </View>

          ) : !activeWorkoutDay ? (
            <View style={{ gap: 12 }}>
              {/* Rest Day card — with daily tip + streak check-in */}
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="moon" size={28} color={theme.textSecondary} />
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, marginLeft: 12, flex: 1 }}>Rest Day</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
                  <Ionicons name="bulb" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 1, marginBottom: 3 }}>FORME TIP</Text>
                    <Text style={{ fontSize: 13, color: theme.text, flex: 1, lineHeight: 18 }}>{getTodayTip()}</Text>
                  </View>
                </View>
                {/* Rest day check-in for streak */}
                {activeDate === todayStr && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                    <Pressable
                      onPress={handleRestDayCheckIn}
                      disabled={restDayCheckedIn}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: restDayCheckedIn ? `${focusCardColor}15` : `${focusCardColor}20`,
                        borderRadius: 12, paddingVertical: 10,
                      }}
                    >
                      <Ionicons
                        name={restDayCheckedIn ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={18}
                        color={restDayCheckedIn ? '#22C55E' : focusCardColor}
                      />
                      <Text style={{
                        fontSize: 13, fontWeight: '600',
                        color: restDayCheckedIn ? '#22C55E' : focusCardColor,
                      }}>
                        {restDayCheckedIn ? 'Checked In — Streak Saved!' : 'Check In to Keep Your Streak'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Next Workout Preview — compact by default, expandable */}
              {nextWorkout && activeDate >= todayStr && (() => {
                const nextDayIdx = DAY_NAMES_FULL.findIndex((n) => n.toLowerCase() === nextWorkout.dayName.toLowerCase());
                const daysUntil = nextDayIdx > activeIdx ? nextDayIdx - activeIdx : nextDayIdx + 7 - activeIdx;
                const nextDateLabel = daysUntil === 1 ? 'Tomorrow' : DAY_NAMES_FULL[nextDayIdx];
                return (
                  <Pressable onPress={() => { animateLayout(); setUpNextExpanded((p) => !p); }}>
                    <BreathingGradient color={focusCardColor} style={{ borderRadius: 24 }}>
                      <View style={{ paddingHorizontal: 20, paddingVertical: upNextExpanded ? 24 : 18 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <Text allowFontScaling style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                              Up Next — {nextDateLabel}
                            </Text>
                            <Text allowFontScaling style={{ fontSize: upNextExpanded ? 28 : 22, fontWeight: '800', color: '#FFFFFF', lineHeight: upNextExpanded ? 34 : 28 }}>
                              {stripParens(nextWorkout.focus)}
                            </Text>
                          </View>
                          <Ionicons name={upNextExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#FFFFFFCC" />
                        </View>
                        {!upNextExpanded && (
                          <View style={{ marginTop: 8 }}>
                            <MuscleGroupPills categories={getExerciseCategories(nextWorkout.exercises)} size="small" />
                          </View>
                        )}
                        {upNextExpanded && (
                          <>
                            <View style={{ marginTop: 16, gap: 6 }}>
                              {nextWorkout.exercises.map((ex: any, i: number) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 14, color: '#FFFFFFCC', fontWeight: '400' }}>
                                    {i + 1}. {ex.name}
                                  </Text>
                                </View>
                              ))}
                            </View>
                            <View style={{ marginTop: 12 }}>
                              <MuscleGroupPills categories={getExerciseCategories(nextWorkout.exercises)} size="small" />
                            </View>
                          </>
                        )}
                      </View>
                    </BreathingGradient>
                  </Pressable>
                );
              })()}

              {/* Weekly Volume Trend */}
              {userId && <WeeklyVolumeTrend userId={userId} accentColor={focusCardColor} onInteractionStart={() => setScrollEnabled(false)} onInteractionEnd={() => setScrollEnabled(true)} />}

              {/* Recovery Map */}
              <RecoveryMapCard recentLogs={recentLogs} />

              {/* Quick Workout + Weigh-In */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => router.push('/workout/quick')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: theme.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${focusCardColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash" size={20} color={focusCardColor} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Quick Workout</Text>
                </Pressable>
                {userId && <BodyStatsCard userId={userId} />}
              </View>

              {/* Trophy Case */}
              {userId && <TrophyCaseCard userId={userId} />}

            </View>

          ) : (
            <View style={{ gap: 12 }}>
              {/* Focus card - shows resume state when workout is active */}
              {activeWorkout && !todayCompleted && !selectedDate ? (() => {
                const completedSets = activeWorkout.loggedExercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0);
                const totalSets = activeWorkout.loggedExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
                const hasStarted = getElapsedMs() > 1000;
                return (
                  <Pressable
                    onPress={() => {
                      if (activeWorkout.dayIndex === -1) {
                        router.push('/workout/quick');
                      } else {
                        router.push(`/workout/${activeWorkout.dayIndex}`);
                      }
                    }}
                    style={{ borderRadius: 24 }}
                  >
                    <BreathingGradient
                      color={focusCardColor}
                      style={{ borderRadius: 24 }}
                    >
                      <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                            {activeWorkout.dayIndex === -1
                              ? (hasStarted ? "Quick Workout \u00B7 In Progress" : "Quick Workout \u00B7 Ready")
                              : (hasStarted ? "Today's Workout \u00B7 In Progress" : "Today's Workout \u00B7 Ready")}
                          </Text>
                          <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', lineHeight: 34 }}>
                            {stripParens(activeWorkout.dayIndex === -1 ? activeWorkout.dayName : (activeWorkout.focus || activeWorkout.dayName))}
                          </Text>
                        </View>
                        <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
                      </View>
                      {/* Exercise progress */}
                      <View style={{ marginTop: 16, gap: 6 }}>
                        {activeWorkout.loggedExercises.map((ex, i) => {
                          const done = ex.sets.filter((s) => s.completed).length;
                          return (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name={done === ex.sets.length ? 'checkmark-circle' : 'ellipse-outline'} size={12} color={done === ex.sets.length ? '#FFFFFF' : '#FFFFFF99'} style={{ marginRight: 6 }} />
                              <Text style={{ fontSize: 14, color: done === ex.sets.length ? '#FFFFFF' : '#FFFFFFCC', fontWeight: done === ex.sets.length ? '600' : '400' }}>
                                {ex.name}
                              </Text>
                              <Text style={{ fontSize: 12, color: '#FFFFFF99', marginLeft: 'auto' }}>{done}/{ex.sets.length}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={{ marginTop: 12 }}>
                        <MuscleGroupPills categories={getExerciseCategories(activeWorkout.loggedExercises)} size="small" />
                      </View>
                      </View>
                    </BreathingGradient>
                  </Pressable>
                );
              })() : (
                <Pressable
                  onPress={() => {
                    const idx = plan.weeklyPlan.indexOf(activeWorkoutDay);
                    router.push(`/workout/${idx}`);
                  }}
                  style={{ borderRadius: 24 }}
                >
                  <BreathingGradient
                    color={focusCardColor}
                    style={{ borderRadius: 24 }}
                  >
                    <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        {!selectedDate && (
                          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFFCC', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
                            Today's Workout
                          </Text>
                        )}
                        <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: '#FFFFFF', lineHeight: 34 }}>
                          {stripParens(activeWorkoutDay.focus)}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
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
                    <View style={{ marginTop: 12 }}>
                      <MuscleGroupPills categories={getExerciseCategories(activeWorkoutDay.exercises)} size="small" />
                    </View>
                    </View>
                  </BreathingGradient>
                </Pressable>
              )}

              {/* Weekly Volume Trend */}
              {userId && <WeeklyVolumeTrend userId={userId} accentColor={focusCardColor} onInteractionStart={() => setScrollEnabled(false)} onInteractionEnd={() => setScrollEnabled(true)} />}

              {/* Recovery Map */}
              <RecoveryMapCard recentLogs={recentLogs} />

              {/* Quick Workout + Weigh-In */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => router.push('/workout/quick')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: theme.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${focusCardColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="flash" size={20} color={focusCardColor} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Quick Workout</Text>
                </Pressable>
                {userId && <BodyStatsCard userId={userId} />}
              </View>

              {/* Daily Tip */}
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons name="bulb" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 1, marginBottom: 3 }}>FORME TIP</Text>
                  <Text style={{ fontSize: 13, color: theme.text, flex: 1, lineHeight: 18 }}>{getTodayTip()}</Text>
                </View>
              </View>

              {/* Trophy Case */}
              {userId && <TrophyCaseCard userId={userId} />}
            </View>
          )}

          {/* Today's activities */}
          {todayActivities.length > 0 && (
            <View>
              {todayActivities.map((act) => (
                <View key={act.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                  <Text style={{ fontSize: 13, color: theme.text, flex: 1 }}>
                    {act.type}{act.duration_minutes ? ` · ${act.duration_minutes} min` : ''}
                    {act.calories_burned ? ` · ${act.calories_burned} cal` : ''}
                    {act.notes ? ` · ${act.notes}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Total Cal + Steps — per selected date */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {trackCalories && (
              <Pressable
                onPress={() => router.push('/(tabs)/meals')}
                style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.border }}
              >
                <Text allowFontScaling style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 2 }}>Total Cal</Text>
                <Text allowFontScaling numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                  {todayCalories != null ? `${todayCalories}` : '-'}
                </Text>
              </Pressable>
            )}
            <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.border }}>
              <Text allowFontScaling style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 2 }}>Steps</Text>
              <Text allowFontScaling numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                {steps != null ? formatNumber(steps) : '-'}
              </Text>
            </View>
          </View>

          {/* Bottom spacer for FAB */}
          <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* FAB backdrop + menu — Modal covers entire screen including tab bar */}
      <Modal visible={fabOpen} transparent animationType="none" statusBarTranslucent>
        <Pressable
          onPress={toggleFab}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        {/* FAB menu items — inside Modal so they appear above the overlay */}
        <View style={{ position: 'absolute', bottom: 92, right: 20, alignItems: 'flex-end', gap: 12 }}>
          {[
            { label: 'Add Walk', onPress: () => { toggleFab(); setActivityType('Walk'); setShowActivitySheet(true); } },
            { label: 'Add Run', onPress: () => { toggleFab(); setActivityType('Run'); setShowActivitySheet(true); } },
            { label: 'Add Activity', onPress: () => { toggleFab(); setShowActivitySheet(true); } },
            { label: 'Add Meal', onPress: () => { toggleFab(); setShowMealSheet(true); } },
          ].map((item, i) => (
            <Animated.View
              key={item.label}
              style={{
                opacity: fabAnim,
                transform: [{
                  translateY: fabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20 + i * 10, 0],
                  }),
                }],
              }}
            >
              <Pressable
                onPress={item.onPress}
                style={{ backgroundColor: theme.surface, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1.5, borderColor: theme.chrome + '60' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{item.label}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </Modal>

      {/* FAB button */}
      <Pressable
        onPress={toggleFab}
        style={{
          position: 'absolute', bottom: 20, right: 20, zIndex: 11,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: focusCardColor,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: focusCardColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
        }}
      >
        <Animated.View style={{ transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Animated.View>
      </Pressable>

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

        {/* Calories Burned */}
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>Calories Burned (optional)</Text>
        <TextInput
          style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: theme.text, marginBottom: 8, opacity: activityCalNotSure ? 0.4 : 1 }}
          keyboardType="number-pad"
          placeholder=""
          placeholderTextColor={theme.textSecondary}
          value={activityCalories}
          onChangeText={setActivityCalories}
          editable={!activityCalNotSure}
        />
        <Pressable
          onPress={() => setActivityCalNotSure((p) => !p)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}
        >
          <View style={{
            width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
            borderColor: activityCalNotSure ? theme.text : theme.chrome,
            backgroundColor: activityCalNotSure ? theme.text : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {activityCalNotSure && <Ionicons name="checkmark" size={14} color={theme.background} />}
          </View>
          <Text style={{ fontSize: 13, color: theme.textSecondary }}>Not sure — estimate for me</Text>
        </Pressable>
        {activityCalNotSure && (() => {
          const est = getCalorieEstimate();
          return est ? (
            <Text style={{ fontSize: 13, color: focusCardColor, fontWeight: '600', marginBottom: 8, marginLeft: 28 }}>
              Estimated: {est.low}–{est.high} cal
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, marginLeft: 28 }}>
              {!userWeightKg ? 'Set your weight in profile for estimates' : 'Enter duration above for estimate'}
            </Text>
          );
        })()}

        {/* Notes */}
        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6, marginTop: 4 }}>Notes (optional)</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Add meal</Text>
          <Pressable
            onPress={() => { setShowMealSheet(false); router.push('/barcode-scanner'); }}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.border }}
          >
            <Ionicons name="barcode-outline" size={18} color={theme.text} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Scan</Text>
          </Pressable>
        </View>

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
