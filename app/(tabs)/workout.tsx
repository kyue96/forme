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

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { AppHeader } from '@/components/AppHeader';
import { LoggedExercise } from '@/lib/types';
import { animateLayout } from '@/lib/utils';

const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
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

  const dayDate = new Date(monday);
  dayDate.setDate(monday.getDate() + dayIdx);
  const month = dayDate.getMonth() + 1;
  const day = dayDate.getDate();
  return `${dayName} ${month}/${day}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { plan, loading } = usePlan();
  const { theme, weightUnit } = useSettings();
  const { logId } = useLocalSearchParams<{ logId?: string }>();

  const [showHistory, setShowHistory] = useState(false);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // selectedLog state removed — now navigates to session-view
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [todayLoggedDays, setTodayLoggedDays] = useState<Set<string>>(new Set());

  // Open a specific log when navigated from the home screen calendar.
  const consumedLogId = useRef<string | null>(null);
  useEffect(() => {
    if (logId && logs.length > 0 && consumedLogId.current !== logId) {
      const match = logs.find((l) => l.id === logId);
      if (match) {
        consumedLogId.current = logId;
        setShowHistory(true);
        router.push({
          pathname: '/workout/session-view',
          params: {
            exercises: JSON.stringify(match.exercises),
            dayName: match.day_name,
            focus: match.day_name,
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <View>
            <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 2 }}>
              My Plan
            </Text>
            <Text allowFontScaling style={{ fontSize: 13, color: theme.textSecondary }}>
              Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => {
                animateLayout();
                setShowHistory(false);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: !showHistory ? theme.text : theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: !showHistory ? theme.text : theme.border,
              }}
            >
              <Ionicons name="barbell" size={20} color={!showHistory ? theme.background : theme.chrome} />
            </Pressable>
            <Pressable
              onPress={() => {
                animateLayout();
                setShowHistory(true);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: showHistory ? theme.text : theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: showHistory ? theme.text : theme.border,
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={showHistory ? theme.background : theme.chrome} />
            </Pressable>
          </View>
        </View>

        {showHistory ? (
          /* Past workout history */
          <View>
            <Text allowFontScaling style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16 }}>
              Workout history
            </Text>
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
              logs.map((log) => {
                const date = new Date(log.completed_at).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                });
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
                        router.push({
                          pathname: '/workout/session-view',
                          params: {
                            exercises: JSON.stringify(log.exercises),
                            dayName: log.day_name,
                            focus: log.day_name,
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
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View>
                        <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                          {log.day_name}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                          {date} · {totalSets} sets · {log.duration_minutes} min
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={theme.chrome} />
                    </Pressable>
                  </Swipeable>
                );
              })
            )}
          </View>
        ) : (
          /* Weekly plan — accordion */
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
              plan.weeklyPlan.map((day, i) => {
                const isOpen = expandedDay === i;
                const dayLogged = todayLoggedDays.has(day.dayName.toLowerCase());
                return (
                  <View
                    key={i}
                    style={{
                      marginBottom: 10,
                      borderRadius: 16,
                      backgroundColor: theme.surface,
                      borderWidth: 1,
                      borderColor: theme.border,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Collapsed header */}
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
                        <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
                          {formatDayDate(day.dayName)}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>
                          {day.focus}
                        </Text>
                        <Text allowFontScaling style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                          {day.exercises.length} exercises
                        </Text>
                      </View>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.chrome}
                      />
                    </Pressable>

                    {/* Expanded exercises */}
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
                                {ex.sets} sets · {ex.reps} reps · {ex.rest} rest
                              </Text>
                            </View>
                          </View>
                        ))}

                        {dayLogged ? (
                          <View style={{ marginTop: 8, backgroundColor: theme.background, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#22C55E' }}>
                            <Text allowFontScaling style={{ color: '#22C55E', fontWeight: '700', fontSize: 13 }}>
                              Workout logged ✓
                            </Text>
                          </View>
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
                              Start workout →
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Log detail modal removed — now navigates to /workout/session-view */}
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
