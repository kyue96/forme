import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

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
import { EXERCISE_DATABASE, BODYWEIGHT_KEYWORDS } from '@/lib/exercise-data';

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

export default function WorkoutScreen() {
  const router = useRouter();
  const { plan, loading, refetch } = usePlan();
  const { theme } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const focusCardColor = avatarColor || '#F59E0B';
  const { logId } = useLocalSearchParams<{ logId?: string }>();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [todayLoggedDays, setTodayLoggedDays] = useState<Set<string>>(new Set());
  const [swapTarget, setSwapTarget] = useState<{ dayIdx: number; exIdx: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);


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
            focus: matchPlanDay?.focus ?? match.day_name,
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Date ranges
      const weekDates = getWeekDates();
      const weekStart = dateKey(weekDates[0]);
      const w1Mon = new Date(weekDates[0]); w1Mon.setDate(w1Mon.getDate() - 14);

      const { data: recentLogs } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', dateKey(w1Mon))
        .order('completed_at', { ascending: false });

      const allLogs = (recentLogs ?? []) as WorkoutLog[];

      setLogs(allLogs.slice(0, 30));

      const todayStr = dateKey(new Date());
      const todayLogs = allLogs.filter((l) => l.completed_at?.startsWith(todayStr));
      setTodayLoggedDays(new Set(todayLogs.map((l) => l.day_name?.toLowerCase())));
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { loadAllData(); }, [loadAllData]));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
    );
  }

  // Compute next workout day
  const jsDow = new Date().getDay();
  const jsDayName = DAY_NAMES_FULL[jsDow].toLowerCase();
  const todayPlanIdx = plan?.weeklyPlan.findIndex(d => d.dayName.toLowerCase() === jsDayName) ?? -1;
  const nextPlanIdx = todayPlanIdx >= 0 && !todayLoggedDays.has(plan?.weeklyPlan[todayPlanIdx]?.dayName.toLowerCase() ?? '')
    ? todayPlanIdx
    : (plan?.weeklyPlan.findIndex((d, i) => {
        const dIdx = DAY_NAMES_FULL.findIndex(n => n.toLowerCase() === d.dayName.toLowerCase());
        return dIdx > jsDow && !todayLoggedDays.has(d.dayName.toLowerCase());
      }) ?? -1);

  const reorderDays = useCallback(async (reorderedDays: WorkoutDay[]) => {
    if (!plan) return;
    // Collect the original dayName slots in order
    const originalDayNames = plan.weeklyPlan.map((d) => d.dayName);
    // Assign original dayName slots to the reordered focuses
    const updatedPlan = reorderedDays.map((day, i) => ({
      ...day,
      dayName: originalDayNames[i],
    }));
    const newPlan = { ...plan, weeklyPlan: updatedPlan };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('workout_plans')
        .update({ plan: newPlan })
        .eq('id', plan.id)
        .eq('user_id', user.id);

      // Defer refetch to avoid nulling plan during DraggableFlatList render cycle
      setTimeout(() => refetch(), 100);
    } catch (err) {
      console.error('Failed to reorder days:', err);
      Alert.alert('Error', 'Failed to reorder days');
    }
  }, [plan, refetch]);


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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('workout_plans')
        .update({ plan: newPlan })
        .eq('id', plan.id)
        .eq('user_id', user.id);

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
        },
      },
    ]);
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

  const renderPlanCard = (day: WorkoutDay, i: number, dayLogged: boolean, isNext: boolean, isMissed: boolean, drag: () => void) => {
    const isOpen = expandedDay === day.dayName;
    return (
      <View
        key={day.dayName}
        style={{
          marginBottom: 10,
          borderRadius: 16,
          backgroundColor: isNext ? focusCardColor : theme.surface,
          borderWidth: dayLogged ? 1 : 0,
          borderColor: dayLogged ? '#22C55E' : 'transparent',
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Edit mode: drag handle */}
          {editMode && (
            <Pressable
              onLongPress={drag}
              style={{ paddingLeft: 12, paddingRight: 4, justifyContent: 'center' }}
            >
              <Ionicons name="reorder-three" size={20} color={isNext ? '#FFFFFFCC' : theme.chrome} />
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              if (editMode) return;
              animateLayout();
              setExpandedDay(isOpen ? null : day.dayName);
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: editMode ? 8 : 16,
              paddingRight: 16,
              paddingVertical: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text allowFontScaling style={{ fontSize: 11, color: isNext ? '#FFFFFF99' : theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                {formatDayDate(day.dayName)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: isNext ? '#FFFFFF' : theme.text }}>
                  {stripParens(day.focus)}
                </Text>
              </View>
              <Text allowFontScaling style={{ fontSize: 12, color: isNext ? '#FFFFFFCC' : theme.textSecondary, marginTop: 2 }}>
                {day.exercises.length} exercises
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MuscleGroupPills categories={getExerciseCategories(day.exercises)} size="small" />
              {!editMode && (
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={isNext ? '#FFFFFFCC' : theme.chrome}
                />
              )}
            </View>
          </Pressable>
        </View>

        {isOpen && !editMode && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ height: 1, backgroundColor: isNext ? '#FFFFFF30' : theme.border, marginBottom: 12 }} />
            {day.exercises.map((ex: Exercise, j: number) => (
              <Pressable
                key={j}
                onPress={() => setSwapTarget({ dayIdx: i, exIdx: j })}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isNext ? '#FFFFFF80' : theme.chrome, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: isNext ? '#FFFFFF' : theme.text }}>
                    {ex.name}
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 11, color: isNext ? '#FFFFFFAA' : theme.textSecondary, marginTop: 1 }}>
                    {ex.sets} sets · {ex.reps} reps
                  </Text>
                </View>
                <Ionicons name="repeat-outline" size={16} color={isNext ? '#FFFFFF80' : theme.chrome} />
              </Pressable>
            ))}

            <Pressable
              onPress={() => router.push({
                pathname: '/workout/edit-plan-day',
                params: {
                  dayIdx: String(i),
                  dayName: day.dayName,
                  focus: day.focus,
                  exercises: JSON.stringify(day.exercises),
                },
              })}
              style={{
                marginTop: 4,
                marginBottom: 8,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Full View</Text>
            </Pressable>

            {dayLogged ? (
              <View style={{ marginTop: 8, backgroundColor: theme.background, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#22C55E' }}>
                <Text allowFontScaling style={{ color: '#22C55E', fontWeight: '700', fontSize: 13 }}>
                  Workout logged
                </Text>
              </View>
            ) : isMissed ? (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Missed workout',
                    `This workout was scheduled for ${day.dayName}. Start it anyway?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Start anyway', onPress: () => router.push(`/workout/${i}`) },
                    ],
                  );
                }}
                style={{
                  marginTop: 8,
                  backgroundColor: theme.textSecondary,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 13 }}>
                  Start late
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push(`/workout/${i}`)}
                style={{
                  marginTop: 8,
                  backgroundColor: isNext ? '#FFFFFF' : theme.text,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text allowFontScaling style={{ color: isNext ? focusCardColor : theme.background, fontWeight: '700', fontSize: 13 }}>
                  Start workout
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      {/* Weekly calendar strip - outside ScrollView padding */}
      {/* Header with title, edit, history toggle */}
      <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
        {showHistory ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
              Recent Workouts
            </Text>
            <Pressable
              onPress={() => setShowHistory(false)}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
                My Workout Plan
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={() => {
                    animateLayout();
                    setEditMode(!editMode);
                    if (editMode) setExpandedDay(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: focusCardColor }}>
                    {editMode ? 'Done' : 'Edit'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowHistory(true)}
                  hitSlop={8}
                >
                  <Ionicons name="time-outline" size={22} color={theme.text} />
                </Pressable>
              </View>
            </View>
            {plan && (
              <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary }}>
                {plan.weeklyPlan.length} days a week
              </Text>
            )}
          </>
        )}
      </View>

      {showHistory ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Recent Workouts List */}
          {logs.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="barbell-outline" size={28} color={theme.border} />
              <Text allowFontScaling style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>
                No workouts logged yet.
              </Text>
            </View>
          ) : (
            logs.map((log) => {
              const dateObj = new Date(log.completed_at);
              const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const logPlanDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === log.day_name.toLowerCase());
              return (
                <Swipeable
                  key={log.id}
                  renderRightActions={renderHistoryRightActions(log.id)}
                  overshootRight={false}
                >
                  <Pressable
                    onPress={() => {
                      router.push({
                        pathname: '/workout/session-view',
                        params: {
                          exercises: JSON.stringify(log.exercises),
                          dayName: log.day_name,
                          focus: logPlanDay?.focus ?? log.day_name,
                          durationMinutes: String(log.duration_minutes ?? 0),
                          completedAt: log.completed_at,
                          logId: log.id,
                        },
                      });
                    }}
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: 16,
                      marginBottom: 10,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingVertical: 14,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                          {dateLabel}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                          {stripParens(logPlanDay?.focus ?? log.day_name)}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                          {log.exercises.length} exercises
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MuscleGroupPills categories={getExerciseCategories(log.exercises)} size="small" />
                        <Ionicons name="chevron-forward" size={18} color={theme.chrome} />
                      </View>
                    </View>
                  </Pressable>
                </Swipeable>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <DraggableFlatList
            data={plan?.weeklyPlan ?? []}
            scrollEnabled
            keyExtractor={(item) => item.focus}
            activationDistance={10}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            ListEmptyComponent={
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
            }
            ListHeaderComponent={plan ? (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <Pressable
                  onPress={() => router.push('/workout/quick')}
                  style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                >
                  <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                    Create Workout
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/quiz/1')}
                  style={{ flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                >
                  <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                    Rebuild Plan
                  </Text>
                </Pressable>
              </View>
            ) : null}
            onDragEnd={({ data }) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              reorderDays(data);
            }}
            renderItem={({ item, drag, isActive }: RenderItemParams<WorkoutDay>) => {
              const days = plan?.weeklyPlan ?? [];
              const i = days.findIndex(d => d.focus === item.focus);
              const idx = i >= 0 ? i : 0;
              const dayLogged = todayLoggedDays.has(item.dayName.toLowerCase());
              const isNext = idx === nextPlanIdx && !dayLogged;
              const dIdx = DAY_NAMES_FULL.findIndex(d => d.toLowerCase() === item.dayName.toLowerCase());
              const isMissed = jsDow >= 1 && jsDow <= 5 && dIdx >= 0 && dIdx < jsDow && !dayLogged;
              return (
                <View style={{ opacity: isActive ? 0.8 : 1, transform: [{ scale: isActive ? 1.02 : 1 }] }}>
                  {renderPlanCard(item, idx, dayLogged, isNext, isMissed, drag)}
                </View>
              );
            }}
          />
        </View>
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
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
