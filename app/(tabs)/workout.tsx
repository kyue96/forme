import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { BadgesTab } from '@/components/BadgesTab';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { AppHeader } from '@/components/AppHeader';
import { WeeklyCalendar, getWeekDates, dateKey, DAY_NAMES_FULL } from '@/components/WeeklyCalendar';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { LoggedExercise } from '@/lib/types';
import { animateLayout } from '@/lib/utils';
import { getExerciseCategories } from '@/lib/exercise-utils';

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

function formatDayDate(dayName: string): string {
  // Calculate the target week's Monday (if Sat/Sun, use next week)
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 6=Sat
  let mondayOffset: number;
  if (dow === 0) {
    // Sunday: show next week (tomorrow is Monday)
    mondayOffset = 1;
  } else if (dow === 6) {
    // Saturday: show next week (Monday is +2 days)
    mondayOffset = 2;
  } else {
    // Mon-Fri: show current week
    mondayOffset = 1 - dow;
  }
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const dayIdx = DAY_NAMES_FULL.findIndex(d => d.toLowerCase() === dayName.toLowerCase());
  if (dayIdx < 0) return dayName;

  // DAY_NAMES_FULL is Sun-Sat (0-6), convert to Mon-based offset (Mon=0)
  const monBasedIdx = dayIdx === 0 ? 6 : dayIdx - 1;
  const dayDate = new Date(monday);
  dayDate.setDate(monday.getDate() + monBasedIdx);
  return dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();
  const { theme, weightUnit } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const focusCardColor = avatarColor || '#F59E0B';
  const { logId } = useLocalSearchParams<{ logId?: string }>();

  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'badges'>('plan');
  const [showPastDays, setShowPastDays] = useState(false);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // selectedLog state removed - now navigates to session-view
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [todayLoggedDays, setTodayLoggedDays] = useState<Set<string>>(new Set());
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set());

  // Open a specific log when navigated from the home screen calendar.
  const consumedLogId = useRef<string | null>(null);
  useEffect(() => {
    if (logId && logs.length > 0 && consumedLogId.current !== logId) {
      const match = logs.find((l) => l.id === logId);
      if (match) {
        consumedLogId.current = logId;
        setActiveTab('history');
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

  const loadHistory = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('workout_logs')
        .select('id, day_name, exercises, duration_minutes, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(30);
      setLogs((data as WorkoutLog[]) ?? []);

      // Check which days have been logged today
      const todayStr = dateKey(new Date());
      const todayLogs = (data ?? []).filter((l: any) => l.completed_at?.startsWith(todayStr));
      setTodayLoggedDays(new Set(todayLogs.map((l: any) => l.day_name?.toLowerCase())));

      // Build completedDays for the weekly calendar
      const weekDates = getWeekDates();
      const weekStart = dateKey(weekDates[0]);
      const weekEnd = dateKey(weekDates[6]);
      const weekLogs = (data ?? []).filter((l: any) => {
        const dk = l.completed_at?.split('T')[0];
        return dk >= weekStart && dk <= weekEnd;
      });
      setCompletedDays(new Set(weekLogs.map((l: any) => l.completed_at?.split('T')[0])));
    } catch {} finally {
      setLogsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const removeLog = (logId: string) => {
    Alert.alert('Remove workout', 'Delete this workout log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_logs').delete().eq('id', logId);
          loadHistory();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={theme.chrome} />
      </SafeAreaView>
    );
  }

  const unitLabel = weightUnit === 'lbs' ? 'lbs' : 'kg';

  // Build planDayNames set for the calendar
  const planDayNames = new Set(
    (plan?.weeklyPlan ?? []).map((d) => d.dayName.toLowerCase())
  );

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

  const handleCalendarDayPress = (date: Date, dayIndex: number) => {
    if (!plan) return;
    // Find the plan day matching this calendar day
    const dayName = DAY_NAMES_FULL[dayIndex].toLowerCase();
    const planIdx = plan.weeklyPlan.findIndex((d) => d.dayName.toLowerCase() === dayName);
    if (planIdx >= 0) {
      animateLayout();
      setActiveTab('plan');
      setExpandedDay(expandedDay === planIdx ? null : planIdx);
    }
  };

  const swipeDelete = (logId: string) => {
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('workout_logs').delete().eq('id', logId);
          loadHistory();
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

  const renderPlanCard = (day: typeof plan.weeklyPlan[0], i: number, dayLogged: boolean, isNext: boolean, isMissed: boolean) => {
    const isOpen = expandedDay === i;
    return (
      <View
        key={i}
        style={{
          marginBottom: 10,
          borderRadius: 16,
          backgroundColor: isNext ? focusCardColor : theme.surface,
          borderWidth: dayLogged ? 1 : 0,
          borderColor: dayLogged ? '#22C55E' : 'transparent',
          overflow: 'hidden',
          opacity: 1,
        }}
      >
        <Pressable
          onPress={() => {
            animateLayout();
            setExpandedDay(isOpen ? null : i);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text allowFontScaling style={{ fontSize: 11, color: isNext ? '#FFFFFF99' : theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
              {formatDayDate(day.dayName)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: isNext ? '#FFFFFF' : theme.text }}>
                {day.focus}
              </Text>
              {!isNext && <MuscleGroupPills categories={getExerciseCategories(day.exercises)} size="normal" />}
            </View>
            <Text allowFontScaling style={{ fontSize: 12, color: isNext ? '#FFFFFFCC' : theme.textSecondary, marginTop: 2 }}>
              {day.exercises.length} exercises
            </Text>
          </View>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isNext ? '#FFFFFFCC' : theme.chrome}
          />
        </Pressable>

        {isOpen && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 12 }} />
            {day.exercises.map((ex, j) => (
              <View key={j} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.chrome, marginTop: 6, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                    {ex.name}
                  </Text>
                  <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 1 }}>
                    {ex.sets} sets · {ex.reps} reps
                  </Text>
                </View>
              </View>
            ))}

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
                  backgroundColor: theme.text,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text allowFontScaling style={{ color: theme.background, fontWeight: '700', fontSize: 13 }}>
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
      {plan && (
        <WeeklyCalendar
          completedDays={completedDays}
          onDayPress={handleCalendarDayPress}
          planDayNames={planDayNames}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
            {activeTab === 'plan' ? 'Plan' : activeTab === 'history' ? 'History' : 'Achievements'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable
              onPress={() => {
                animateLayout();
                setActiveTab('plan');
              }}
              hitSlop={8}
            >
              <Ionicons name="barbell" size={22} color={activeTab === 'plan' ? focusCardColor : theme.chrome} />
            </Pressable>
            <Pressable
              onPress={() => {
                animateLayout();
                setActiveTab('history');
              }}
              hitSlop={8}
            >
              <Ionicons name="calendar-outline" size={22} color={activeTab === 'history' ? focusCardColor : theme.chrome} />
            </Pressable>
            <Pressable
              onPress={() => {
                animateLayout();
                setActiveTab('badges');
              }}
              hitSlop={8}
            >
              <Ionicons name="trophy-outline" size={22} color={activeTab === 'badges' ? focusCardColor : theme.chrome} />
            </Pressable>
          </View>
        </View>

        {activeTab === 'history' ? (
          /* Past workout history */
          <View>
            {logsLoading ? (
              <ActivityIndicator color={theme.chrome} />
            ) : logs.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="barbell-outline" size={32} color={theme.border} />
                <Text allowFontScaling style={{ color: theme.textSecondary, marginTop: 8 }}>
                  No workouts logged yet.
                </Text>
              </View>
            ) : (
              (() => {
                // Group logs by date
                const dateGroups: { [key: string]: typeof logs } = {};
                logs.forEach((log) => {
                  const dateStr = log.completed_at.split('T')[0];
                  if (!dateGroups[dateStr]) {
                    dateGroups[dateStr] = [];
                  }
                  dateGroups[dateStr].push(log);
                });
                const sortedDates = Object.keys(dateGroups).sort();

                return sortedDates.map((dateStr) => {
                  const dateObj = new Date(dateStr);
                  const dayAbbr = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

                  return (
                    <View key={dateStr} style={{ flexDirection: 'row', marginBottom: 16 }}>
                      {/* Left column with date */}
                      <View style={{ width: 60, paddingRight: 12, alignItems: 'center', paddingTop: 4, position: 'relative' }}>
                        <Text allowFontScaling style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>
                          {dayAbbr}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                          {monthDay}
                        </Text>
                        {/* Vertical connector line */}
                        <View style={{ position: 'absolute', left: 29, top: 40, bottom: -16, width: 1, backgroundColor: theme.border }} />
                      </View>

                      {/* Right column with cards */}
                      <View style={{ flex: 1 }}>
                        {dateGroups[dateStr].map((log) => {
                          const totalSets = log.exercises.reduce((s, ex) => s + ex.sets.filter((se) => se.completed).length, 0);
                          return (
                            <Swipeable
                              key={log.id}
                              renderRightActions={renderHistoryRightActions(log.id)}
                              overshootRight={false}
                              friction={2}
                            >
                              <Pressable
                                onPress={() => {
                                  const logPlanDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === log.day_name.toLowerCase());
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
                                  padding: 16,
                                  marginBottom: 10,
                                  borderWidth: 1,
                                  borderColor: theme.border,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                                    {plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === log.day_name.toLowerCase())?.focus ?? log.day_name}
                                  </Text>
                                  <Ionicons name="chevron-forward" size={18} color={theme.chrome} />
                                </View>
                                <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary }}>
                                  {totalSets} sets · {log.duration_minutes} min
                                </Text>
                                <View style={{ marginTop: 4 }}>
                                  <MuscleGroupPills categories={getExerciseCategories(log.exercises)} size="small" />
                                </View>
                              </Pressable>
                            </Swipeable>
                          );
                        })}
                      </View>
                    </View>
                  );
                });
              })()
            )}
          </View>
        ) : activeTab === 'badges' ? (
          <BadgesTab />
        ) : (
          /* Weekly plan - accordion */
          <View>
            {!plan ? (
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
            ) : (
              <>
              <Pressable
                onPress={() => router.push('/workout/quick')}
                style={{ marginBottom: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              >
                <Text allowFontScaling style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                  Create Workout
                </Text>
              </Pressable>
              {(() => {
                // Split plan into past and upcoming
                const pastDays: { day: typeof plan.weeklyPlan[0]; i: number }[] = [];
                const upcomingDays: { day: typeof plan.weeklyPlan[0]; i: number }[] = [];
                plan.weeklyPlan.forEach((day, i) => {
                  const dIdx = DAY_NAMES_FULL.findIndex(d => d.toLowerCase() === day.dayName.toLowerCase());
                  const logged = todayLoggedDays.has(day.dayName.toLowerCase());
                  if (dIdx >= 0 && dIdx < jsDow && !logged) {
                    pastDays.push({ day, i });
                  } else {
                    upcomingDays.push({ day, i });
                  }
                });

                return (
                  <>
                    {/* Past days toggle */}
                    {pastDays.length > 0 && (
                      <Pressable
                        onPress={() => { animateLayout(); setShowPastDays(!showPastDays); }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                          paddingVertical: 10, marginBottom: 8, borderRadius: 12,
                          backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
                        }}
                      >
                        <Ionicons name={showPastDays ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
                          {showPastDays ? 'Hide' : 'Show'} previous days ({pastDays.length})
                        </Text>
                      </Pressable>
                    )}
                    {showPastDays && pastDays.map(({ day, i }) => {
                      const dayLogged = false; // past unlogged by definition
                      const isMissed = true;
                      return renderPlanCard(day, i, dayLogged, false, isMissed);
                    })}
                    {upcomingDays.map(({ day, i }) => {
                      const dayLogged = todayLoggedDays.has(day.dayName.toLowerCase());
                      const isNext = i === nextPlanIdx && !dayLogged;
                      return renderPlanCard(day, i, dayLogged, isNext, false);
                    })}
                  </>
                );
              })()}


              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Log detail modal removed - now navigates to /workout/session-view */}
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
