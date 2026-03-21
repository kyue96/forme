import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { BadgesTab } from '@/components/BadgesTab';
import { StreakRing } from '@/components/StreakRing';
import { WeeklyVolumeCard } from '@/components/WeeklyVolumeCard';
import { MuscleGroupPills } from '@/components/MuscleGroupPills';
import { AppHeader } from '@/components/AppHeader';

import { usePlan } from '@/lib/plan-context';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings-context';
import { useUserStore } from '@/lib/user-store';
import { LoggedExercise } from '@/lib/types';
import { animateLayout, stripParens } from '@/lib/utils';
import { getExerciseCategories } from '@/lib/exercise-utils';
import { dateKey, getWeekDates } from '@/components/WeeklyCalendar';

interface WorkoutLog {
  id: string;
  day_name: string;
  exercises: LoggedExercise[];
  duration_minutes: number;
  completed_at: string;
}

export default function StatsScreen() {
  const router = useRouter();
  const { plan } = usePlan();
  const { theme, weightUnit } = useSettings();
  const avatarColor = useUserStore((s) => s.avatarColor);
  const focusCardColor = avatarColor || '#F59E0B';

  const [activeTab, setActiveTab] = useState<'stats' | 'badges'>('stats');
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Stats data
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [weekVolume, setWeekVolume] = useState(0);
  const [weeklyVolData, setWeeklyVolData] = useState<[any[], any[], any[]]>([[], [], []]);
  const [volDelta, setVolDelta] = useState<number | null>(null);

  const loadAllData = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekDates = getWeekDates();
      const weekStart = dateKey(weekDates[0]);
      const weekEnd = dateKey(weekDates[6]);
      const w1Mon = new Date(weekDates[0]); w1Mon.setDate(w1Mon.getDate() - 14);

      const [{ data: recentLogs }, { data: streakLogs }] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('id, day_name, exercises, duration_minutes, completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', dateKey(w1Mon))
          .order('completed_at', { ascending: false }),
        supabase
          .from('workout_logs')
          .select('completed_at')
          .eq('user_id', user.id)
          .gte('completed_at', (() => { const d = new Date(); d.setDate(d.getDate() - 60); return dateKey(d); })())
          .order('completed_at', { ascending: false }),
      ]);

      const allLogs = (recentLogs ?? []) as WorkoutLog[];
      setLogs(allLogs.slice(0, 30));

      // --- Streak ---
      const streakDatesList = (streakLogs ?? []).map((l: any) => l.completed_at?.split('T')[0]).filter(Boolean);
      const streakDatesSet = new Set(streakDatesList);

      let s = 0;
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      if (!streakDatesSet.has(dateKey(d))) d.setDate(d.getDate() - 1);
      while (streakDatesSet.has(dateKey(d))) { s++; d.setDate(d.getDate() - 1); }
      setStreak(s);

      const sorted = Array.from(streakDatesSet).sort();
      let best = 0, run = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1] + 'T12:00:00');
        const curr = new Date(sorted[i] + 'T12:00:00');
        if (Math.round((curr.getTime() - prev.getTime()) / 86400000) === 1) { run++; } else { best = Math.max(best, run); run = 1; }
      }
      setMaxStreak(Math.max(best, run));

      // --- Weekly volume (3 weeks) ---
      const lastWeekMon = new Date(weekDates[0]); lastWeekMon.setDate(lastWeekMon.getDate() - 7);
      const lastWeekSun = new Date(weekDates[0]); lastWeekSun.setDate(lastWeekSun.getDate() - 1);

      const filterByRange = (start: string, end: string) =>
        allLogs.filter((l) => {
          const dk = l.completed_at?.split('T')[0];
          return dk && dk >= start && dk <= end;
        });

      const thisWeekLogs = filterByRange(weekStart, weekEnd);
      const lastWeekLogs = filterByRange(dateKey(lastWeekMon), dateKey(lastWeekSun));
      const w1Logs = filterByRange(dateKey(w1Mon), dateKey(new Date(weekDates[0].getTime() - 8 * 86400000)));

      const calcVolume = (logsList: WorkoutLog[]) =>
        logsList.reduce((total, log) => {
          const exs = log.exercises as LoggedExercise[];
          return total + exs.reduce((s2, ex) =>
            s2 + ex.sets.filter(se => se.completed && se.weight != null).reduce((v, se) => v + (se.weight ?? 0) * se.reps, 0), 0);
        }, 0);

      const calcLogVolume = (log: WorkoutLog) => {
        const exs = log.exercises as LoggedExercise[];
        return exs.reduce((s2, ex) =>
          s2 + ex.sets.filter(se => se.completed && se.weight != null).reduce((v, se) => v + (se.weight ?? 0) * se.reps, 0), 0);
      };

      const thisVol = calcVolume(thisWeekLogs);
      const lastVol = calcVolume(lastWeekLogs);
      const conv = weightUnit === 'lbs' ? 2.205 : 1;
      setWeekVolume(Math.round(thisVol * conv));
      setVolDelta(lastVol > 0 ? ((thisVol - lastVol) / lastVol) * 100 : null);

      const buildDailyVol = (logsList: WorkoutLog[], mondayDate: Date) => {
        const days = Array.from({ length: 7 }, (_, i) => {
          const dd = new Date(mondayDate);
          dd.setDate(dd.getDate() + i);
          return { day: dateKey(dd), volume: 0 };
        });
        logsList.forEach((log) => {
          const logDate = log.completed_at?.split('T')[0];
          const entry = days.find((dd) => dd.day === logDate);
          if (entry) entry.volume += Math.round(calcLogVolume(log) * conv);
        });
        return days;
      };

      setWeeklyVolData([
        buildDailyVol(w1Logs, w1Mon),
        buildDailyVol(lastWeekLogs, lastWeekMon),
        buildDailyVol(thisWeekLogs, weekDates[0]),
      ]);
    } catch {} finally {
      setLogsLoading(false);
    }
  }, [weightUnit]);

  useFocusEffect(useCallback(() => { loadAllData(); }, [loadAllData]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <AppHeader />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
        <Text allowFontScaling style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>
          {activeTab === 'stats' ? 'Stats' : 'Achievements'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable
            onPress={() => { animateLayout(); setActiveTab('stats'); }}
            hitSlop={8}
          >
            <Ionicons name="analytics-outline" size={22} color={activeTab === 'stats' ? focusCardColor : theme.chrome} />
          </Pressable>
          <Pressable
            onPress={() => { animateLayout(); setActiveTab('badges'); }}
            hitSlop={8}
          >
            <Ionicons name="trophy-outline" size={22} color={activeTab === 'badges' ? focusCardColor : theme.chrome} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'stats' ? (
          <View style={{ gap: 12 }}>
            <StreakRing streak={streak} maxStreak={maxStreak} size="large" color={focusCardColor} />
            {weeklyVolData[2].length > 0 && (
              <WeeklyVolumeCard
                weeks={weeklyVolData}
                totalVolume={weekVolume}
                deltaPercent={volDelta}
                accentColor={focusCardColor}
              />
            )}

            {/* Recent Workouts */}
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text allowFontScaling style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                  Recent Workouts
                </Text>
                {logs.length > 2 && (
                  <Pressable onPress={() => { animateLayout(); setShowAllWorkouts(!showAllWorkouts); }} hitSlop={8}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: focusCardColor }}>
                      {showAllWorkouts ? 'Show less' : 'View all'}
                    </Text>
                  </Pressable>
                )}
              </View>
              {logsLoading ? (
                <ActivityIndicator color={theme.chrome} />
              ) : logs.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Ionicons name="barbell-outline" size={28} color={theme.border} />
                  <Text allowFontScaling style={{ color: theme.textSecondary, marginTop: 8, fontSize: 13 }}>
                    No workouts logged yet.
                  </Text>
                </View>
              ) : (
                (showAllWorkouts ? logs : logs.slice(0, 2)).map((log) => {
                  const totalSets = log.exercises.reduce((s, ex) => s + ex.sets.filter((se) => se.completed).length, 0);
                  const dateObj = new Date(log.completed_at);
                  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const logPlanDay = plan?.weeklyPlan.find(d => d.dayName.toLowerCase() === log.day_name.toLowerCase());
                  return (
                    <Pressable
                      key={log.id}
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
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: theme.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text allowFontScaling style={{ fontSize: 14, fontWeight: '700', color: theme.text }} numberOfLines={1}>
                            {stripParens(logPlanDay?.focus ?? log.day_name)}
                          </Text>
                          <MuscleGroupPills categories={getExerciseCategories(log.exercises)} size="small" />
                        </View>
                        <Text allowFontScaling style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3 }}>
                          {dateLabel} · {totalSets} sets · {log.duration_minutes}m
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.chrome} />
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        ) : (
          <BadgesTab />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
