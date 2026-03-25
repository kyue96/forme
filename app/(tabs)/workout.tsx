import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import Svg, { Path } from 'react-native-svg';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { AppHeader } from '@/components/AppHeader';
import { getWeekDates, dateKey, DAY_NAMES_FULL } from '@/components/WeeklyCalendar';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { LoggedExercise, WorkoutDay, Exercise } from '@/lib/types';
import { animateLayout, stripParens } from '@/lib/utils';
import { getExerciseCategories, getExerciseCategory } from '@/lib/exercise-utils';
import { useCustomExerciseStore, CustomExercise } from '@/lib/custom-exercise-store';
import { CustomExerciseSheet } from '@/components/CustomExerciseSheet';
import { EXERCISE_DATABASE, BODYWEIGHT_KEYWORDS } from '@/lib/exercise-data';

/**
 * Sawtooth/zigzag SVG edge — creates a "torn paper" / puzzle-piece edge.
 * Renders as a standalone flex child with the box color filling the tooth shape.
 * `side="right"` = right edge of left box (teeth point right)
 * `side="left"`  = left edge of right box (teeth point left)
 */
const TOOTH_W = 5;
const TOOTH_H = 8;
function SawtoothEdge({ height, color, side }: { height: number; color: string; side: 'left' | 'right' }) {
  if (height <= 0) return null;
  const teeth = Math.max(2, Math.ceil(height / TOOTH_H));
  const svgH = teeth * TOOTH_H;
  let d: string;
  if (side === 'right') {
    // Flat left edge, zigzag right edge
    d = `M0,0`;
    for (let i = 0; i < teeth; i++) {
      d += ` L${TOOTH_W},${i * TOOTH_H + TOOTH_H / 2} L0,${(i + 1) * TOOTH_H}`;
    }
    d += ` L0,0 Z`;
  } else {
    // Zigzag left edge, flat right edge
    d = `M${TOOTH_W},0`;
    for (let i = 0; i < teeth; i++) {
      d += ` L0,${i * TOOTH_H + TOOTH_H / 2} L${TOOTH_W},${(i + 1) * TOOTH_H}`;
    }
    d += ` L${TOOTH_W},0 Z`;
  }
  return (
    <View style={{ width: TOOTH_W, alignSelf: 'stretch', overflow: 'visible' }}>
      <Svg width={TOOTH_W} height={svgH} viewBox={`0 0 ${TOOTH_W} ${svgH}`}>
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

function formatDayDate(dayName: string, refDate?: Date | null): string {
  // If a reference date is provided, use its week; otherwise use current/next week
  let monday: Date;
  if (refDate) {
    const ref = new Date(refDate);
    const refDow = ref.getDay(); // 0=Sun
    const monOffset = refDow === 0 ? -6 : 1 - refDow;
    monday = new Date(ref);
    monday.setDate(ref.getDate() + monOffset);
  } else {
    const now = new Date();
    const dow = now.getDay();
    let mondayOffset: number;
    if (dow === 0) mondayOffset = 1;
    else if (dow === 6) mondayOffset = 2;
    else mondayOffset = 1 - dow;
    monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
  }

  const dayIdx = DAY_NAMES_FULL.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
  if (dayIdx < 0) return dayName;

  const monBasedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
  const dayDate = new Date(monday);
  dayDate.setDate(monday.getDate() + monBasedIdx);
  return dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/* ─── Pre-made workout templates ─── */
const WORKOUT_TEMPLATES: { name: string; icon: string; exercises: { name: string; sets: number; reps: string }[] }[] = [
  {
    name: 'Chest & Triceps',
    icon: 'fitness-outline',
    exercises: [
      { name: 'Flat Barbell Bench Press', sets: 4, reps: '8-10' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
      { name: 'Cable Flyes', sets: 3, reps: '12-15' },
      { name: 'Dips', sets: 3, reps: '8-12' },
      { name: 'Tricep Pushdowns', sets: 3, reps: '12-15' },
      { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Back & Biceps',
    icon: 'fitness-outline',
    exercises: [
      { name: 'Deadlifts', sets: 4, reps: '5-6' },
      { name: 'Barbell Rows', sets: 4, reps: '8-10' },
      { name: 'Lat Pulldowns', sets: 3, reps: '10-12' },
      { name: 'Seated Cable Rows', sets: 3, reps: '10-12' },
      { name: 'Barbell Curls', sets: 3, reps: '10-12' },
      { name: 'Hammer Curls', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Shoulders & Traps',
    icon: 'fitness-outline',
    exercises: [
      { name: 'Overhead Press', sets: 4, reps: '8-10' },
      { name: 'Dumbbell Lateral Raises', sets: 4, reps: '12-15' },
      { name: 'Rear Delt Flyes', sets: 3, reps: '12-15' },
      { name: 'Face Pulls', sets: 3, reps: '15-20' },
      { name: 'Barbell Shrugs', sets: 4, reps: '10-12' },
      { name: 'Dumbbell Front Raises', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Legs',
    icon: 'fitness-outline',
    exercises: [
      { name: 'Barbell Squats', sets: 4, reps: '6-8' },
      { name: 'Romanian Deadlifts', sets: 3, reps: '8-10' },
      { name: 'Leg Press', sets: 3, reps: '10-12' },
      { name: 'Walking Lunges', sets: 3, reps: '12 each' },
      { name: 'Leg Curls', sets: 3, reps: '10-12' },
      { name: 'Calf Raises', sets: 4, reps: '15-20' },
    ],
  },
  {
    name: 'Push Day',
    icon: 'arrow-up-outline',
    exercises: [
      { name: 'Flat Barbell Bench Press', sets: 4, reps: '6-8' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12' },
      { name: 'Dumbbell Lateral Raises', sets: 3, reps: '12-15' },
      { name: 'Tricep Pushdowns', sets: 3, reps: '12-15' },
      { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Pull Day',
    icon: 'arrow-down-outline',
    exercises: [
      { name: 'Barbell Rows', sets: 4, reps: '6-8' },
      { name: 'Lat Pulldowns', sets: 3, reps: '10-12' },
      { name: 'Seated Cable Rows', sets: 3, reps: '10-12' },
      { name: 'Face Pulls', sets: 3, reps: '15-20' },
      { name: 'Barbell Curls', sets: 3, reps: '10-12' },
      { name: 'Hammer Curls', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Full Body',
    icon: 'body-outline',
    exercises: [
      { name: 'Barbell Squats', sets: 3, reps: '8-10' },
      { name: 'Flat Barbell Bench Press', sets: 3, reps: '8-10' },
      { name: 'Barbell Rows', sets: 3, reps: '8-10' },
      { name: 'Overhead Press', sets: 3, reps: '8-10' },
      { name: 'Romanian Deadlifts', sets: 3, reps: '10-12' },
      { name: 'Barbell Curls', sets: 2, reps: '10-12' },
      { name: 'Tricep Pushdowns', sets: 2, reps: '12-15' },
    ],
  },
];

export default function WorkoutScreen() {
  const router = useRouter();
  const { plan, loading, refetch, setPlan } = usePlan();
  const { theme, weightUnit } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const storeUserId = useUserStore((s) => s.userId);
  const focusCardColor = avatarColor || '#F59E0B';
  const { logId } = useLocalSearchParams<{ logId?: string }>();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [todayLoggedDays, setTodayLoggedDays] = useState<Set<string>>(new Set());
  const [weekLoggedDays, setWeekLoggedDays] = useState<Set<string>>(new Set());
  const [swapTarget, setSwapTarget] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editOrder, setEditOrder] = useState<WorkoutDay[] | null>(null); // local reorder during edit
  const [viewMode, setViewMode] = useState<'plan' | 'history' | 'saved'>('plan');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const createdAt = useUserStore((s) => s.createdAt);

  // Saved routines state
  interface SavedRoutine { id: string; name: string; exercises: { name: string; sets: number; reps: string }[]; last_used_at: string; }
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>([]);
  const [savedRoutinesLoading, setSavedRoutinesLoading] = useState(false);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [expandedTemplateIdx, setExpandedTemplateIdx] = useState<number | null>(null);
  const [editingRoutineName, setEditingRoutineName] = useState('');
  const customExercises = useCustomExerciseStore(s => s.exercises);
  const customExercisesLoaded = useCustomExerciseStore(s => s.loaded);
  const loadCustomExercises = useCustomExerciseStore(s => s.load);
  const removeCustomExercise = useCustomExerciseStore(s => s.remove);
  const updateCustomExercise = useCustomExerciseStore(s => s.update);
  const [editingCustomExercise, setEditingCustomExercise] = useState<CustomExercise | null>(null);

  // History calendar state
  const now = new Date();
  const [historyMonth, setHistoryMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(dateKey(now));
  const [historyLogs, setHistoryLogs] = useState<WorkoutLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCalExpanded, setHistoryCalExpanded] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [historyScrollEnabled, setHistoryScrollEnabled] = useState(true);
  const historyLogDates = useMemo(() => new Set(historyLogs.map(l => l.completed_at?.split('T')[0])), [historyLogs]);

  // Min date for history calendar (month user joined)
  const historyMinDate = useMemo(() => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [createdAt]);

  // Refs for swipe navigation — avoid stale closures in PanResponder
  const historyCalExpandedRef = useRef(false);
  useEffect(() => { historyCalExpandedRef.current = historyCalExpanded; }, [historyCalExpanded]);
  const historyMonthRef = useRef(historyMonth);
  useEffect(() => { historyMonthRef.current = historyMonth; }, [historyMonth]);
  const selectedHistoryDateRef = useRef(selectedHistoryDate);
  useEffect(() => { selectedHistoryDateRef.current = selectedHistoryDate; }, [selectedHistoryDate]);
  const historyMinDateRef = useRef(historyMinDate);
  useEffect(() => { historyMinDateRef.current = historyMinDate; }, [historyMinDate]);

  const historyCalPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderGrant: () => {
        setHistoryScrollEnabled(false);
      },
      onPanResponderRelease: (_, gs) => {
        setHistoryScrollEnabled(true);
        if (Math.abs(gs.dx) < 30) return;
        const dir = gs.dx > 0 ? -1 : 1; // swipe left = forward, right = back

        if (historyCalExpandedRef.current) {
          // Expanded: change month
          const { year, month } = historyMonthRef.current;
          const min = historyMinDateRef.current;
          const nowD = new Date();
          if (dir === -1 && min && year === min.year && month === min.month) return;
          if (dir === 1 && year === nowD.getFullYear() && month === nowD.getMonth()) return;
          let newMonth = month + dir;
          let newYear = year;
          if (newMonth < 0) { newMonth = 11; newYear--; }
          if (newMonth > 11) { newMonth = 0; newYear++; }
          setHistoryMonth({ year: newYear, month: newMonth });
          const dk = `${newYear}-${String(newMonth + 1).padStart(2, '0')}-01`;
          setSelectedHistoryDate(dk);
        } else {
          // Collapsed: change week (±7 days)
          const current = new Date(selectedHistoryDateRef.current + 'T12:00:00');
          current.setDate(current.getDate() + (dir * 7));
          const todayStr = dateKey(new Date());
          const dk = dateKey(current);
          if (dk > todayStr) return;
          const min = historyMinDateRef.current;
          if (min) {
            const minStr = `${min.year}-${String(min.month + 1).padStart(2, '0')}-01`;
            if (dk < minStr) return;
          }
          setSelectedHistoryDate(dk);
          if (current.getFullYear() !== historyMonthRef.current.year || current.getMonth() !== historyMonthRef.current.month) {
            setHistoryMonth({ year: current.getFullYear(), month: current.getMonth() });
          }
        }
      },
      onPanResponderTerminate: () => {
        setHistoryScrollEnabled(true);
      },
    })
  ).current;

  // Load logs for the selected history month
  const loadHistoryMonth = useCallback(async (year: number, month: number) => {
    setHistoryLoading(true);
    try {
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = new Date(year, month + 1, 0);
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59`;
      const { data } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', uid)
        .gte('completed_at', start)
        .lte('completed_at', end)
        .order('completed_at', { ascending: false });
      setHistoryLogs((data as WorkoutLog[]) ?? []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load history when month changes or history is shown
  useEffect(() => {
    if (viewMode === 'history') {
      loadHistoryMonth(historyMonth.year, historyMonth.month);
    }
  }, [viewMode, historyMonth.year, historyMonth.month, loadHistoryMonth]);

  const selectedDayLogs = useMemo(() =>
    historyLogs.filter(l => l.completed_at?.startsWith(selectedHistoryDate)),
    [historyLogs, selectedHistoryDate]
  );

  // Load saved routines when switching to saved tab
  const loadSavedRoutines = useCallback(async () => {
    setSavedRoutinesLoading(true);
    try {
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('saved_routines')
        .select('id, name, exercises, last_used_at')
        .eq('user_id', uid)
        .order('last_used_at', { ascending: false })
        .limit(50);
      if (data) setSavedRoutines(data as SavedRoutine[]);
    } catch {} finally {
      setSavedRoutinesLoading(false);
    }
  }, [storeUserId]);

  useEffect(() => {
    if (viewMode === 'saved') {
      loadSavedRoutines();
      if (!customExercisesLoaded) loadCustomExercises();
    }
  }, [viewMode, loadSavedRoutines]);

  // Also reload saved routines on screen focus when in saved mode
  const lastSavedFetchRef = useRef(0);
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastSavedFetchRef.current < 30000) return;
    lastSavedFetchRef.current = now;
    if (viewMode === 'saved') loadSavedRoutines();
  }, [viewMode, loadSavedRoutines]));

  const deleteSavedRoutine = useCallback(async (routineId: string, routineName: string) => {
    Alert.alert('Delete Routine', `Remove "${routineName}" from saved workouts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_routines').delete().eq('id', routineId);
          setSavedRoutines(prev => prev.filter(r => r.id !== routineId));
        },
      },
    ]);
  }, []);

  const renameRoutine = useCallback(async (routineId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) { setEditingRoutineId(null); return; }
    await supabase.from('saved_routines').update({ name: trimmed }).eq('id', routineId);
    setSavedRoutines(prev => prev.map(r => r.id === routineId ? { ...r, name: trimmed } : r));
    setEditingRoutineId(null);
  }, []);

  // Open a specific log when navigated from the home screen calendar.
  const consumedLogId = useRef<string | null>(null);
  useEffect(() => {
    if (logId && logs.length > 0 && consumedLogId.current !== logId) {
      const match = logs.find((l) => l.id === logId);
      if (match) {
        consumedLogId.current = logId;
        const matchPlanDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === match.day_name.toLowerCase());
        router.push({
          pathname: '/workout/session-view',
          params: {
            exercises: JSON.stringify(match.exercises),
            dayName: match.day_name,
            focus: match.day_name || matchPlanDay?.focus || '',
            durationMinutes: String(match.duration_minutes ?? 0),
            completedAt: match.completed_at,
            logId: match.id,
          },
        });
      }
    }
  }, [logId, logs]);

  const loadAllData = useCallback(async () => {
    try {
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;

      // Date ranges
      const weekDates = getWeekDates();
      const weekStart = dateKey(weekDates[0]);
      const w1Mon = new Date(weekDates[0]); w1Mon.setDate(w1Mon.getDate() - 14);

      const { data: recentLogs } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', uid)
        .gte('completed_at', dateKey(w1Mon))
        .order('completed_at', { ascending: false });

      const allLogs = (recentLogs ?? []) as WorkoutLog[];

      setLogs(allLogs.slice(0, 30));

      const todayStr = dateKey(new Date());
      const todayLogs = allLogs.filter((l) => l.completed_at?.startsWith(todayStr));
      setTodayLoggedDays(new Set(todayLogs.map((l) => l.day_name?.toLowerCase())));

      // Week logged days — all workouts completed since Monday
      const weekLogs = allLogs.filter((l) => l.completed_at?.split('T')[0] >= weekStart);
      setWeekLoggedDays(new Set(weekLogs.map((l) => l.day_name?.toLowerCase())));
    } catch {}
  }, []);

  const lastFetchRef = useRef(0);
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < 30000) return;
    lastFetchRef.current = now;
    loadAllData();
  }, [loadAllData]));

  // Compute next workout day — first unlogged workout from today onward
  const jsDow = new Date().getDay();
  const nextPlanIdx = (() => {
    if (!plan) return -1;
    // First: find the first unlogged day that is today or in the future
    const todayOrFuture = plan.weeklyPlan.findIndex(d => {
      const dIdx = DAY_NAMES_FULL.findIndex(n => n.toLowerCase() === d.dayName.toLowerCase());
      return dIdx >= jsDow && !weekLoggedDays.has(d.dayName.toLowerCase());
    });
    if (todayOrFuture >= 0) return todayOrFuture;
    // Fallback: first unlogged day at all (missed day)
    return plan.weeklyPlan.findIndex(d => !weekLoggedDays.has(d.dayName.toLowerCase()));
  })();

  // Auto-expand the next workout card
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (nextPlanIdx >= 0 && plan?.weeklyPlan[nextPlanIdx] && !autoExpandedRef.current && !editMode) {
      autoExpandedRef.current = true;
      setExpandedDay(plan.weeklyPlan[nextPlanIdx].dayName);
    }
  }, [nextPlanIdx, plan, editMode]);

  const reorderDays = useCallback(async (reorderedDays: WorkoutDay[]) => {
    if (!plan) return;
    // Collect the original dayName slots in order
    const origNames = plan.weeklyPlan.map((d) => d.dayName);
    // Assign original dayName slots to the reordered focuses
    const updatedPlan = reorderedDays.map((day, i) => ({
      ...day,
      dayName: origNames[i],
    }));
    const newPlan = { ...plan, weeklyPlan: updatedPlan };

    // Optimistic update — no refetch, no blank flash
    setPlan(newPlan);

    try {
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;

      await supabase
        .from('workout_plans')
        .update({ plan: newPlan })
        .eq('id', plan.id)
        .eq('user_id', uid);
    } catch (err) {
      console.error('Failed to reorder days:', err);
      // Revert on failure
      setPlan(plan);
      Alert.alert('Error', 'Failed to reorder days');
    }
  }, [plan, setPlan, storeUserId]);


  const swapExercise = useCallback(async (newExerciseName: string) => {
    if (!plan || !swapTarget) return;

    const dayIdx = swapTarget.dayIdx;
    const exIdx = swapTarget.exIdx;

    const newPlan = {
      ...plan,
      weeklyPlan: plan.weeklyPlan.map((day, i) => {
        if (i === dayIdx) {
          return {
            ...day,
            exercises: day.exercises.map((ex, j) => {
              if (j === exIdx) {
                return { ...ex, name: newExerciseName };
              }
              return ex;
            }),
          };
        }
        return day;
      }),
    };

    try {
      const uid = storeUserId || (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;

      await supabase
        .from('workout_plans')
        .update({ plan: newPlan })
        .eq('id', plan.id)
        .eq('user_id', uid);

      refetch();
      setSwapTarget(null);
      animateLayout();
    } catch (err) {
      console.error('Failed to swap exercise:', err);
      Alert.alert('Error', 'Failed to swap exercise');
    }
  }, [plan, swapTarget, refetch]);

  const swipeDelete = (logId: string) => {
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_logs').delete().eq('id', logId);
          loadAllData();
          loadHistoryMonth(historyMonth.year, historyMonth.month);
        },
      },
    ]);
  };

  const directDelete = async (logId: string) => {
    await supabase.from('workout_logs').delete().eq('id', logId);
    loadAllData();
    loadHistoryMonth(historyMonth.year, historyMonth.month);
  };

  const renderHistoryRightActions = (logId: string) => () => (
    <Pressable
      onPress={() => swipeDelete(logId)}
      style={{
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        borderRadius: 16,
        marginBottom: 10,
        marginLeft: 8,
      }}
    >
      <Ionicons name="trash-outline" size={20} color="#fff" />
    </Pressable>
  );

  // Height of compact edit-mode card row (day label + workout card)
  const EDIT_ROW_H = 56;

  // Original day names (fixed left column in edit mode)
  const originalDayNames = useMemo(() => (plan?.weeklyPlan ?? []).map(d => d.dayName), [plan]);

  // Estimate workout duration from exercise sets & rest
  const estimateDuration = (exercises: Exercise[]): number => {
    const warmUp = 8 * 60; // ~8 min warm-up
    let totalSeconds = warmUp;
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      const restSeconds = parseInt(ex.rest) || 60;
      totalSeconds += ex.sets * (45 + restSeconds); // ~45s work per set + rest
      if (i > 0) totalSeconds += 60; // ~1 min transition between exercises
    }
    return Math.round(totalSeconds / 60);
  };

  // Weekly progress
  const totalPlanDays = plan?.weeklyPlan.length ?? 0;
  const completedThisWeek = plan?.weeklyPlan.filter(d => weekLoggedDays.has(d.dayName.toLowerCase())).length ?? 0;

  /** Non-edit mode: combined two-box row */
  const renderPlanCard = (day: WorkoutDay, i: number, dayLogged: boolean, isNext: boolean, isMissed: boolean) => {
    const isOpen = expandedDay === day.dayName;
    const dayAbbrev = day.dayName.substring(0, 3).toUpperCase();
    const loggedBorder = dayLogged ? '#22C55E' : theme.border;
    const estMin = estimateDuration(day.exercises);

    // Determine if Start Workout button should be enabled:
    // enabled for today's workout OR any missed (past) workout this week
    const dayIdx = DAY_NAMES_FULL.findIndex(d => d.toLowerCase() === day.dayName.toLowerCase());
    const isTodayWorkout = dayIdx === jsDow;
    const canStart = isTodayWorkout || isMissed;

    return (
      <View key={`${day.focus}-${i}`} style={{ flexDirection: 'row', marginBottom: 10 }}>
        {/* LEFT: Fixed day label */}
        <View style={{
          width: 64,
          backgroundColor: theme.surface,
          borderTopLeftRadius: 14,
          borderBottomLeftRadius: 14,
          borderWidth: 1,
          borderRightWidth: 0,
          borderColor: loggedBorder,
          justifyContent: 'center',
          alignItems: 'center',
          alignSelf: 'stretch',
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '800', color: theme.textSecondary,
            textTransform: 'uppercase', letterSpacing: 1,
          }}>{dayAbbrev}</Text>
        </View>

        {/* Divider */}
        <View style={{ width: 1, backgroundColor: loggedBorder, alignSelf: 'stretch' }} />

        {/* RIGHT: Workout card */}
        <View style={{
          flex: 1,
          backgroundColor: isNext ? focusCardColor : theme.surface,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 14,
          borderWidth: 1,
          borderLeftWidth: 0,
          borderColor: isNext ? focusCardColor : loggedBorder,
          overflow: 'hidden',
        }}>
          <Pressable
            onPress={() => { animateLayout(); setExpandedDay(isOpen ? null : day.dayName); }}
            style={{ paddingLeft: 14, paddingRight: 14, paddingVertical: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: isNext ? '#FFFFFF' : theme.text }} numberOfLines={1}>
                    {stripParens(day.focus)}
                  </Text>
                  {isNext && (
                    <View style={{
                      backgroundColor: '#000000CC',
                      paddingHorizontal: 6, paddingVertical: 2,
                      borderRadius: 4,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 }}>
                        UPCOMING
                      </Text>
                    </View>
                  )}
                </View>
                <Text allowFontScaling style={{ fontSize: 12, color: isNext ? '#FFFFFFCC' : theme.textSecondary, marginTop: 2 }}>
                  {day.exercises.length} exercises · ~{estMin} min
                </Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={isNext ? '#FFFFFFCC' : theme.chrome} style={{ marginTop: 3 }} />
            </View>
            <View style={{ marginTop: 8 }}>
              <MuscleGroupPills categories={getExerciseCategories(day.exercises)} size="small" />
            </View>
          </Pressable>

          {/* Expanded exercise list */}
          {isOpen && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
              <View style={{ height: 1, backgroundColor: isNext ? '#FFFFFF30' : theme.border, marginBottom: 10 }} />
              {day.exercises.map((ex: Exercise, j: number) => (
                <Pressable
                  key={j}
                  onPress={() => router.push({
                    pathname: '/exercise-demo' as any,
                    params: { exerciseName: ex.name, sets: String(ex.sets), reps: String(ex.reps) },
                  })}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                >
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isNext ? '#FFFFFF80' : theme.chrome, marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: isNext ? '#FFFFFF' : theme.text }}>{ex.name}</Text>
                    <Text allowFontScaling style={{ fontSize: 11, color: isNext ? '#FFFFFFAA' : theme.textSecondary, marginTop: 1 }}>
                      {ex.sets} sets · {ex.reps} reps
                    </Text>
                  </View>
                  <Ionicons name="information-circle-outline" size={16} color={isNext ? '#FFFFFF60' : theme.chrome} />
                </Pressable>
              ))}

              <Pressable
                onPress={() => router.push({
                  pathname: '/workout/edit-plan-day',
                  params: { dayIdx: String(i), dayName: day.dayName, focus: day.focus, exercises: JSON.stringify(day.exercises) },
                })}
                style={{
                  marginTop: 4, marginBottom: 8, paddingVertical: 10, borderRadius: 12,
                  alignItems: 'center', backgroundColor: isNext ? '#FFFFFF20' : theme.background,
                  borderWidth: 1, borderColor: isNext ? '#FFFFFF30' : theme.border,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: isNext ? '#FFFFFF' : theme.text }}>Full View</Text>
              </Pressable>

              {dayLogged ? (
                <View style={{ paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: theme.background, borderWidth: 1, borderColor: '#22C55E' }}>
                  <Text allowFontScaling style={{ color: '#22C55E', fontWeight: '700', fontSize: 13 }}>Workout Logged ✓</Text>
                </View>
              ) : canStart ? (
                <Pressable
                  onPress={() => router.push(`/workout/${i}`)}
                  style={{ paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: isNext ? '#FFFFFF' : theme.text }}
                >
                  <Text allowFontScaling style={{ color: isNext ? focusCardColor : theme.background, fontWeight: '700', fontSize: 13 }}>Start Workout</Text>
                </Pressable>
              ) : (
                <View style={{ paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: isNext ? '#FFFFFF20' : theme.background, borderWidth: 1, borderColor: isNext ? '#FFFFFF30' : theme.border }}>
                  <Text allowFontScaling style={{ color: isNext ? '#FFFFFF80' : theme.textSecondary, fontWeight: '600', fontSize: 13 }}>
                    {formatDayDate(day.dayName)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading && !plan) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      {/* Header with title + tab pills */}
      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
        <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 10 }}>
          {viewMode === 'plan' ? 'My Workout Plan' : viewMode === 'saved' ? 'Saved Workouts' : 'Recent Workouts'}
        </Text>

        {/* Tab pills + edit pencil */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {([
            { key: 'plan' as const, label: 'My Plan', icon: 'barbell-outline' as const },
            { key: 'saved' as const, label: 'Saved', icon: 'bookmark-outline' as const },
            { key: 'history' as const, label: 'History', icon: 'time-outline' as const },
          ]).map((tab) => {
            const isActive = viewMode === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  if (tab.key === 'history' && logs.length > 0) {
                    const latest = new Date(logs[0].completed_at);
                    setHistoryMonth({ year: latest.getFullYear(), month: latest.getMonth() });
                    setSelectedHistoryDate(logs[0].completed_at.split('T')[0]);
                    setHistoryCalExpanded(false);
                  }
                  if (editMode) {
                    setEditOrder(null);
                    setEditMode(false);
                  }
                  animateLayout();
                  setViewMode(tab.key);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isActive ? focusCardColor : theme.surface,
                  borderWidth: 1,
                  borderColor: isActive ? focusCardColor : theme.border,
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : theme.textSecondary}
                />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isActive ? '#FFFFFF' : theme.textSecondary,
                }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
          {/* Edit pencil — inline with tabs */}
          {viewMode === 'plan' && (
            <Pressable
              onPress={() => {
                if (editMode) {
                  setExpandedDay(null);
                  if (editOrder) {
                    reorderDays(editOrder);
                  }
                  animateLayout();
                  setEditOrder(null);
                  setEditMode(false);
                } else {
                  setEditOrder([...(plan?.weeklyPlan ?? [])]);
                  setExpandedDay(null);
                  animateLayout();
                  setEditMode(true);
                }
              }}
              hitSlop={8}
              style={{ marginLeft: 'auto', paddingHorizontal: 4 }}
            >
              {editMode ? (
                <Text style={{ fontSize: 14, fontWeight: '600', color: focusCardColor }}>Done</Text>
              ) : (
                <Ionicons name="pencil-outline" size={18} color={theme.chrome} />
              )}
            </Pressable>
          )}
        </View>
      </View>

      {viewMode === 'history' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={historyScrollEnabled}
        >
          {/* Monthly Calendar — collapsed (week) / expanded (full month) */}
          {(() => {
            const { year, month } = historyMonth;
            const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long' });
            const todayStr = dateKey(new Date());
            const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            // Build grid cells
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDay; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            while (cells.length % 7 !== 0) cells.push(null);

            const allRows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

            // Find the row containing the selected date
            const selectedDayNum = parseInt(selectedHistoryDate.split('-')[2], 10);
            const selectedCellIdx = cells.findIndex(c => c === selectedDayNum);
            const selectedRowIdx = selectedCellIdx >= 0 ? Math.floor(selectedCellIdx / 7) : 0;
            const visibleRows = historyCalExpanded ? allRows : [allRows[selectedRowIdx] ?? allRows[0]];

            const renderCell = (day: number | null, col: number) => {
              if (day === null) return <View key={col} style={{ flex: 1, height: 40 }} />;
              const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dk === todayStr;
              const isSelected = dk === selectedHistoryDate;
              const hasWorkout = historyLogDates.has(dk);
              const isFuture = dk > todayStr;

              return (
                <Pressable
                  key={col}
                  onPress={() => {
                    if (!isFuture) {
                      setSelectedHistoryDate(dk);
                    }
                  }}
                  style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' }}
                  disabled={isFuture}
                >
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isSelected ? focusCardColor : 'transparent',
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: focusCardColor,
                  }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: isSelected || isToday ? '700' : '400',
                      color: isFuture ? theme.border : isSelected ? '#FFFFFF' : theme.text,
                    }}>
                      {day}
                    </Text>
                  </View>
                  {hasWorkout && !isSelected && (
                    <View style={{
                      width: 5, height: 5, borderRadius: 2.5,
                      backgroundColor: focusCardColor,
                      position: 'absolute', bottom: 2,
                    }} />
                  )}
                </Pressable>
              );
            };

            return (
              <View
                {...historyCalPan.panHandlers}
                style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16 }}
              >
                {/* Month label (left) + expand toggle (right) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: historyCalExpanded ? 16 : 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{monthLabel}</Text>
                  <Pressable
                    onPress={() => { animateLayout(); setHistoryCalExpanded(!historyCalExpanded); }}
                    hitSlop={12}
                  >
                    <Ionicons name={historyCalExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.chrome} />
                  </Pressable>
                </View>

                {/* Day headers */}
                <View style={{ flexDirection: 'row' }}>
                  {DAY_HEADERS.map((d, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary }}>{d}</Text>
                    </View>
                  ))}
                </View>

                {/* Date rows — one row when collapsed, all rows when expanded */}
                {visibleRows.map((row, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: 'row', marginBottom: 2 }}>
                    {row.map((day, col) => renderCell(day, col))}
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Selected day workout(s) */}
          {historyLoading ? (
            <ActivityIndicator color={theme.chrome} style={{ marginTop: 16 }} />
          ) : selectedDayLogs.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="barbell-outline" size={28} color={theme.border} />
              <Text allowFontScaling style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>
                {selectedHistoryDate === dateKey(new Date()) ? 'No workouts logged today.' : 'Rest day'}
              </Text>
            </View>
          ) : (
            selectedDayLogs.map((log) => {
              const logPlanDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === log.day_name.toLowerCase());
              const logIsEditable = log.completed_at
                ? (Date.now() - new Date(log.completed_at).getTime()) < 24 * 60 * 60 * 1000
                : false;
              const durationStr = (() => {
                const mins = log.duration_minutes ?? 0;
                if (mins >= 60) {
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return `${h}:${String(m).padStart(2, '0')}:00`;
                }
                return `${mins}:00`;
              })();
              return (
                <Swipeable
                  key={log.id}
                  renderRightActions={logIsEditable ? renderHistoryRightActions(log.id) : undefined}
                  overshootRight={false}
                  enabled={logIsEditable}
                >
                  <View style={{
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    marginBottom: 10,
                    overflow: 'hidden',
                    padding: 16,
                  }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text, flex: 1 }} numberOfLines={1}>
                        {stripParens(logPlanDay?.focus ?? log.day_name)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MuscleGroupPills categories={getExerciseCategories(log.exercises)} size="small" />
                        {logIsEditable ? (
                          <Pressable
                            onPress={() => {
                              if (deleteConfirmId === log.id) {
                                // Second tap — delete directly
                                setDeleteConfirmId(null);
                                directDelete(log.id);
                              } else {
                                // First tap — prime for confirm (auto-reset after 3s)
                                setDeleteConfirmId(log.id);
                                setTimeout(() => setDeleteConfirmId((prev) => prev === log.id ? null : prev), 3000);
                              }
                            }}
                            hitSlop={8}
                          >
                            <Ionicons
                              name={deleteConfirmId === log.id ? 'trash' : 'trash-outline'}
                              size={16}
                              color={deleteConfirmId === log.id ? '#EF4444' : theme.textSecondary}
                            />
                          </Pressable>
                        ) : (
                          <Ionicons name="lock-closed" size={13} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                        )}
                      </View>
                    </View>
                    <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                      {log.exercises.length} exercises · {durationStr}
                    </Text>

                    {/* Exercise details — always visible */}
                    <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 12 }} />
                    {log.exercises.map((ex, exIdx) => {
                      const completedSets = ex.sets.filter(s => s.completed);
                      if (completedSets.length === 0) return null;
                      return (
                        <View key={exIdx} style={{ marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, flex: 1 }} numberOfLines={1}>
                              {ex.name}
                            </Text>
                            {exIdx === 0 && (
                              <Pressable
                                onPress={() => {
                                  router.push({
                                    pathname: '/workout/post-workout',
                                    params: {
                                      exercises: JSON.stringify(log.exercises),
                                      dayName: log.day_name,
                                      focus: logPlanDay?.focus ?? log.day_name,
                                      durationMinutes: String(log.duration_minutes ?? 0),
                                      startedAt: log.completed_at,
                                    },
                                  });
                                }}
                                hitSlop={8}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                              >
                                <Ionicons name="stats-chart" size={12} color={focusCardColor} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: focusCardColor }}>VIEW STATS</Text>
                              </Pressable>
                            )}
                          </View>
                          {completedSets.map((set, setIdx) => {
                            const displayWeight = set.weight != null
                              ? Math.round(set.weight)
                              : null;
                            return (
                              <View key={setIdx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingLeft: 8 }}>
                                <Text style={{ fontSize: 12, color: theme.textSecondary, width: 28 }}>
                                  {set.isDropSet ? 'D' : `${setIdx + 1}`}
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.text }}>
                                  {displayWeight != null ? `${displayWeight} ${weightUnit} × ${set.reps}` : `${set.reps} reps`}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </Swipeable>
              );
            })
          )}
        </ScrollView>
      ) : viewMode === 'saved' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Pre-made Templates ─── */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
              Templates
            </Text>
            <View style={{ gap: 8 }}>
              {WORKOUT_TEMPLATES.map((tpl, idx) => {
                const isExpanded = expandedTemplateIdx === idx;
                return (
                  <View key={tpl.name} style={{ backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                    <Pressable
                      onPress={() => { animateLayout(); setExpandedTemplateIdx(isExpanded ? null : idx); }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${focusCardColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name={tpl.icon as any} size={18} color={focusCardColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{tpl.name}</Text>
                        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>{tpl.exercises.length} exercises</Text>
                      </View>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.chrome} />
                    </Pressable>
                    {isExpanded && (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                        <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, marginBottom: 10 }}>
                          {tpl.exercises.map((ex, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                              <Text style={{ fontSize: 13, color: theme.textSecondary, width: 20, textAlign: 'right', marginRight: 10 }}>{i + 1}</Text>
                              <Text style={{ flex: 1, fontSize: 13, color: theme.text, fontWeight: '500' }}>{ex.name}</Text>
                              <Text style={{ fontSize: 12, color: theme.textSecondary }}>{ex.sets} × {ex.reps}</Text>
                            </View>
                          ))}
                        </View>
                        <Pressable
                          onPress={() => router.push({
                            pathname: '/workout/quick',
                            params: { templateExercises: JSON.stringify(tpl.exercises), templateName: tpl.name },
                          })}
                          style={{ backgroundColor: focusCardColor, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                        >
                          <Ionicons name="play" size={14} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Start Workout</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* ─── Saved Routines ─── */}
          {savedRoutinesLoading ? (
            <ActivityIndicator color={theme.chrome} style={{ marginTop: 32 }} />
          ) : savedRoutines.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 24, paddingHorizontal: 32 }}>
              <Ionicons name="bookmark-outline" size={36} color={theme.border} />
              <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                No saved workouts yet
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                Complete a Quick Workout to save it here.
              </Text>
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{
                  marginTop: 16, paddingHorizontal: 24, paddingVertical: 12,
                  backgroundColor: focusCardColor, borderRadius: 12,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Start Quick Workout</Text>
              </Pressable>
            </View>
          ) : (
            <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
              My Routines
            </Text>
            {savedRoutines.map((routine) => {
              const exerciseNames = routine.exercises.map((e: any) => e.name);
              const displayExercises = exerciseNames.length <= 3
                ? exerciseNames.join(', ')
                : `${exerciseNames.slice(0, 2).join(', ')} + ${exerciseNames.length - 2} more`;
              const lastUsed = routine.last_used_at
                ? (() => {
                    const diff = Math.floor((Date.now() - new Date(routine.last_used_at).getTime()) / (1000 * 60 * 60 * 24));
                    if (diff === 0) return 'Last performed today';
                    if (diff === 1) return 'Last performed yesterday';
                    return `Last performed ${diff} days ago`;
                  })()
                : '';
              const isExpanded = expandedRoutineId === routine.id;
              const isEditing = editingRoutineId === routine.id;

              return (
                <View
                  key={routine.id}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    marginBottom: 10,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ padding: 16 }}>
                    {/* Header row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Pressable
                        onPress={() => { animateLayout(); setExpandedRoutineId(isExpanded ? null : routine.id); }}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}
                      >
                        <Ionicons name="bookmark" size={16} color={focusCardColor} />
                        {isEditing ? (
                          <TextInput
                            style={{ fontSize: 15, fontWeight: '700', color: theme.text, flex: 1, padding: 0, borderBottomWidth: 1, borderBottomColor: focusCardColor }}
                            value={editingRoutineName}
                            onChangeText={setEditingRoutineName}
                            onSubmitEditing={() => renameRoutine(routine.id, editingRoutineName)}
                            onBlur={() => renameRoutine(routine.id, editingRoutineName)}
                            autoFocus
                            returnKeyType="done"
                          />
                        ) : (
                          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, flex: 1 }} numberOfLines={1}>
                            {routine.name}
                          </Text>
                        )}
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.chrome} />
                      </Pressable>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                        <Pressable
                          onPress={() => {
                            setEditingRoutineId(routine.id);
                            setEditingRoutineName(routine.name);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="pencil-outline" size={15} color={theme.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => deleteSavedRoutine(routine.id, routine.name)}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    </View>

                    {/* Exercise summary or expanded list */}
                    {isExpanded ? (
                      <View style={{ marginLeft: 24, marginBottom: 8 }}>
                        {routine.exercises.map((ex: any, i: number) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i < routine.exercises.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
                            <Text style={{ fontSize: 13, color: theme.text, fontWeight: '500', flex: 1 }}>{ex.name}</Text>
                            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{ex.sets} × {ex.reps}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, marginLeft: 24 }}>
                        {displayExercises}
                      </Text>
                    )}

                    {/* Last performed */}
                    {lastUsed ? (
                      <Text style={{ fontSize: 11, color: theme.textSecondary, opacity: 0.7, marginLeft: 24, marginBottom: 12 }}>
                        {lastUsed}
                      </Text>
                    ) : null}

                    {/* Start button */}
                    <Pressable
                      onPress={() => router.push({
                        pathname: '/workout/quick',
                        params: { routineId: routine.id },
                      })}
                      style={{
                        backgroundColor: focusCardColor,
                        paddingVertical: 10,
                        borderRadius: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name="play" size={14} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Start Workout</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {/* Custom exercises section */}
            {customExercises.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                  My Custom Exercises
                </Text>
                <View style={{ backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
                  {customExercises.map((ce, i) => (
                    <View
                      key={ce.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 16, paddingVertical: 12,
                        borderBottomWidth: i < customExercises.length - 1 ? 1 : 0,
                        borderBottomColor: theme.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{ce.name}</Text>
                        <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                          {ce.muscleGroup}{ce.equipment ? ` · ${ce.equipment}` : ''}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Pressable
                          onPress={() => setEditingCustomExercise(ce)}
                          hitSlop={8}
                        >
                          <Ionicons name="pencil-outline" size={15} color={theme.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            Alert.alert('Delete Exercise', `Remove "${ce.name}"?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => removeCustomExercise(ce.id) },
                            ]);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          scrollEnabled={!editMode}
        >
          {/* Create / Rebuild buttons — always visible */}
          {plan ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Quick Workout
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/quiz/1?mode=rebuild')}
                style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Rebuild Plan
                </Text>
              </Pressable>
            </View>
          ) : null}

          {(plan?.weeklyPlan ?? []).length === 0 ? (
            <View style={{ marginTop: 32, alignItems: 'center' }}>
              <Text allowFontScaling style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 24 }}>
                No plan yet. Take the quiz to get started.
              </Text>
              <Pressable
                onPress={() => router.push('/quiz/1')}
                style={{ backgroundColor: theme.text, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 }}
              >
                <Text allowFontScaling style={{ color: theme.background, fontWeight: '700' }}>Take the quiz</Text>
              </Pressable>
            </View>
          ) : editMode && editOrder ? (
            /* ───── EDIT MODE: two-column layout inside same ScrollView ───── */
            <View style={{ flexDirection: 'row' }}>
              {/* Fixed left column — day labels */}
              <View style={{ width: 64 }}>
                {originalDayNames.map((dayName) => (
                  <View
                    key={dayName}
                    style={{
                      height: EDIT_ROW_H, marginBottom: 10,
                      backgroundColor: theme.surface,
                      borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
                      borderWidth: 1, borderRightWidth: 0, borderColor: theme.border,
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {dayName.substring(0, 3).toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Sawtooth edges from left boxes */}
              <View style={{ width: TOOTH_W }}>
                {originalDayNames.map((dayName) => (
                  <View key={`saw-l-${dayName}`} style={{ height: EDIT_ROW_H, marginBottom: 10 }}>
                    <SawtoothEdge height={EDIT_ROW_H} color={theme.surface} side="right" />
                  </View>
                ))}
              </View>

              {/* Gap */}
              <View style={{ width: 4 }} />

              {/* Draggable right cards */}
              <View style={{ flex: 1 }}>
                <DraggableFlatList
                  data={editOrder}
                  keyExtractor={(item) => item.focus}
                  scrollEnabled={false}
                  activationDistance={5}
                  onDragBegin={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  onDragEnd={({ data }) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    animateLayout();
                    setEditOrder(data);
                  }}
                  renderItem={({ item, drag, isActive }: RenderItemParams<WorkoutDay>) => (
                    <ScaleDecorator activeScale={1.04}>
                      <View style={{
                        flexDirection: 'row',
                        height: EDIT_ROW_H,
                        marginBottom: 10,
                        opacity: isActive ? 0.9 : 1,
                      }}>
                        {/* Sawtooth left edge of right card */}
                        <SawtoothEdge height={EDIT_ROW_H} color={theme.surface} side="left" />

                        {/* Workout card */}
                        <Pressable
                          onLongPress={drag}
                          delayLongPress={150}
                          style={{
                            flex: 1,
                            backgroundColor: theme.surface,
                            borderTopRightRadius: 14, borderBottomRightRadius: 14,
                            borderWidth: 1, borderLeftWidth: 0, borderColor: theme.border,
                            flexDirection: 'row', alignItems: 'center',
                            paddingLeft: 10, paddingRight: 14,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                              {stripParens(item.focus)}
                            </Text>
                            <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                              {item.exercises.length} exercises
                            </Text>
                          </View>
                          <MuscleGroupPills categories={getExerciseCategories(item.exercises)} size="small" />
                        </Pressable>
                      </View>
                    </ScaleDecorator>
                  )}
                />
              </View>
            </View>
          ) : (
            /* ───── NORMAL MODE: combined two-box rows ───── */
            (plan?.weeklyPlan ?? []).map((item, idx) => {
              const dayLogged = weekLoggedDays.has(item.dayName.toLowerCase());
              const isNext = idx === nextPlanIdx && !dayLogged;
              const dIdx = DAY_NAMES_FULL.findIndex(d => d.toLowerCase() === item.dayName.toLowerCase());
              const isMissed = !dayLogged && dIdx >= 0 && dIdx < jsDow;
              return renderPlanCard(item, idx, dayLogged, isNext, isMissed);
            })
          )}
        </ScrollView>
      )}

      {/* Exercise Swap Modal */}
      {swapTarget && plan && (
        <Modal
          transparent
          visible={!!swapTarget}
          animationType="slide"
          onRequestClose={() => setSwapTarget(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32, maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Swap Exercise</Text>
                <Pressable onPress={() => setSwapTarget(null)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={theme.chrome} />
                </Pressable>
              </View>

              {(() => {
                const currentExercise = plan.weeklyPlan[swapTarget.dayIdx].exercises[swapTarget.exIdx];
                const currentCategory = getExerciseCategory(currentExercise.name);
                const categoryPill = currentCategory || 'Unknown';

                return (
                  <>
                    <View style={{ marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Exercise</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, flex: 1 }}>
                          {currentExercise.name}
                        </Text>
                        <View style={{ backgroundColor: focusCardColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: focusCardColor, textTransform: 'uppercase' }}>{categoryPill}</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Swap with</Text>

                    <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                      {(() => {
                        const alternatives = currentCategory
                          ? EXERCISE_DATABASE.filter(
                              (ex) => ex.category === currentCategory && ex.name.toLowerCase() !== currentExercise.name.toLowerCase()
                            )
                          : [];

                        if (alternatives.length === 0) {
                          return (
                            <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
                              No alternatives found for this category.
                            </Text>
                          );
                        }

                        // Group by inferred equipment type
                        const inferEquipment = (name: string): string => {
                          const lower = name.toLowerCase();
                          if (lower.includes('barbell') || lower.includes('bench press') || lower.includes('deadlift') || lower.includes('squat rack')) return 'Barbell';
                          if (lower.includes('dumbbell') || lower.includes('db ')) return 'Dumbbell';
                          if (lower.includes('cable') || lower.includes('pulldown') || lower.includes('pushdown') || lower.includes('face pull')) return 'Cable';
                          if (lower.includes('machine') || lower.includes('smith') || lower.includes('leg press') || lower.includes('hack squat') || lower.includes('pec deck') || lower.includes('lat raise machine')) return 'Machine';
                          if (lower.includes('kettlebell') || lower.includes('kb ')) return 'Kettlebell';
                          if (BODYWEIGHT_KEYWORDS.some(kw => lower.includes(kw))) return 'Bodyweight';
                          return 'Other';
                        };

                        const grouped: Record<string, typeof alternatives> = {};
                        alternatives.forEach((alt) => {
                          const equip = inferEquipment(alt.name);
                          if (!grouped[equip]) grouped[equip] = [];
                          grouped[equip].push(alt);
                        });

                        const equipOrder = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Kettlebell', 'Bodyweight', 'Other'];
                        return equipOrder
                          .filter((eq) => grouped[eq]?.length)
                          .map((equip) => (
                            <View key={equip} style={{ marginBottom: 12 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                {equip}
                              </Text>
                              {grouped[equip].map((alt, idx) => (
                                <Pressable
                                  key={idx}
                                  onPress={() => swapExercise(alt.name)}
                                  style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2, backgroundColor: theme.surface }}
                                >
                                  <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>
                                    {alt.name}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          ));
                      })()}
                    </ScrollView>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>
      )}

      {/* Log detail modal removed - now navigates to /workout/session-view */}

      {/* Edit custom exercise sheet */}
      <CustomExerciseSheet
        visible={editingCustomExercise !== null}
        onClose={() => setEditingCustomExercise(null)}
        onSave={(name, muscleGroup, equipment) => {
          if (editingCustomExercise) {
            updateCustomExercise(editingCustomExercise.id, { name, muscleGroup, equipment });
          }
          setEditingCustomExercise(null);
        }}
        initialValues={editingCustomExercise ? {
          name: editingCustomExercise.name,
          muscleGroup: editingCustomExercise.muscleGroup,
          equipment: editingCustomExercise.equipment,
        } : undefined}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
